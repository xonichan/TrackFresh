import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { ApiError, createApiClient } from '../api/client';
import type { Product, ProductDraft, Settings, SettingsDraft } from '../api/types';
import { API_BASE_URL } from '../config';
import { createLocalStore } from '../lib/local-store';
import { ensureNotificationPermission, rescheduleReminders } from '../lib/notifications';
import { applyLocal, enqueue, type QueueOp } from '../lib/queue';
import { runQueue } from '../lib/sync';
import { useAuth } from './AuthContext';

export const DEFAULT_SETTINGS: Settings = {
  notify_frequency: 'daily',
  notify_time: '09:00',
  warn_days: 3,
};

/** Как часто пробовать отправить накопленные изменения, пока что-то осталось. */
const RETRY_INTERVAL_MS = 30_000;

type DataState = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** Изменения, ещё не дошедшие до сервера. */
  pendingCount: number;
  /** Серверная версия перезаписала локальную правку. */
  serverWon: boolean;
  products: Product[];
  settings: Settings;
  notificationsDenied: boolean;
  refresh(): Promise<void>;
  addProduct(draft: ProductDraft): Promise<void>;
  updateProduct(id: string, patch: Partial<ProductDraft>): Promise<void>;
  removeProduct(id: string): Promise<void>;
  saveSettings(draft: SettingsDraft): Promise<void>;
};

const DataContext = createContext<DataState | null>(null);

function draftOf(product: Product): ProductDraft {
  return {
    name: product.name,
    category: product.category,
    expiryDate: product.expiry_date,
    productionDate: product.production_date,
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, getToken, signOut } = useAuth();

  const client = useMemo(
    () => createApiClient({ baseUrl: API_BASE_URL, getToken }),
    [getToken],
  );
  const store = useMemo(() => createLocalStore(AsyncStorage), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverWon, setServerWon] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [queue, setQueue] = useState<QueueOp[]>([]);
  const [notificationsDenied, setNotificationsDenied] = useState(false);

  // Синхронизация должна видеть актуальные значения, не завися от замыканий.
  const latest = useRef({ products, settings, queue });
  latest.current = { products, settings, queue };

  const describe = useCallback(
    (caught: unknown): string =>
      caught instanceof ApiError ? caught.userMessage : 'Не удалось выполнить запрос.',
    [],
  );

  const persist = useCallback(
    async (next: { products?: Product[]; settings?: Settings; queue?: QueueOp[] }) => {
      // Пишем на диск до обновления экрана, чтобы состояние не опережало данные.
      if (next.products) {
        await store.writeProducts(next.products);
      }
      if (next.settings) {
        await store.writeSettings(next.settings);
      }
      if (next.queue) {
        await store.writeQueue(next.queue);
      }
    },
    [store],
  );

  /** Отправляет очередь, затем подтягивает серверный список. */
  const sync = useCallback(async () => {
    const current = latest.current;

    if (current.queue.length > 0) {
      const outcome = await runQueue(current.queue, current.products, client);

      await persist({ queue: outcome.queue, products: outcome.products });
      setQueue(outcome.queue);
      setProducts(outcome.products);

      if (outcome.rejected.length > 0) {
        setError(outcome.rejected[0]!.message);
      }
      if (outcome.serverWonProductIds.length > 0) {
        setServerWon(true);
      }
      if (outcome.stoppedByNetwork) {
        return; // сервер недоступен, список тоже не подтянуть
      }
    }

    const [loadedProducts, loadedSettings] = await Promise.all([
      client.listProducts(),
      client.getSettings(),
    ]);

    await persist({ products: loadedProducts, settings: loadedSettings });
    setProducts(loadedProducts);
    setSettings(loadedSettings);
    setError(null);
  }, [client, persist]);

  const guardedSync = useCallback(async () => {
    try {
      await sync();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        await signOut();
        return;
      }
      setError(describe(caught));
    }
  }, [sync, signOut, describe]);

  useEffect(() => {
    if (!user) {
      setProducts([]);
      setSettings(DEFAULT_SETTINGS);
      setQueue([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      // Сначала показываем то, что уже есть на устройстве.
      const [storedProducts, storedSettings, storedQueue] = await Promise.all([
        store.readProducts(),
        store.readSettings(),
        store.readQueue(),
      ]);

      if (cancelled) {
        return;
      }

      if (storedProducts) {
        setProducts(storedProducts);
      }
      if (storedSettings) {
        setSettings(storedSettings);
      }
      setQueue(storedQueue);
      setLoading(false);

      await guardedSync();
    })();

    return () => {
      cancelled = true;
    };
  }, [user, store, guardedSync]);

  // Повторяем отправку, пока очередь не опустеет.
  useEffect(() => {
    if (!user || queue.length === 0) {
      return;
    }
    const timer = setInterval(() => void guardedSync(), RETRY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user, queue.length, guardedSync]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void ensureNotificationPermission().then((granted) => {
      setNotificationsDenied(!granted);
    });
  }, [user]);

  useEffect(() => {
    if (!user || products.length === 0) {
      return;
    }
    void rescheduleReminders(products, settings, new Date());
  }, [user, products, settings]);

  /**
   * Локальное изменение: сначала на диск, потом на экран, затем попытка отправки.
   */
  const changeLocally = useCallback(
    async (op: QueueOp, nextProducts: Product[]) => {
      const nextQueue = enqueue(latest.current.queue, op);

      await persist({ products: nextProducts, queue: nextQueue });
      setProducts(nextProducts);
      setQueue(nextQueue);

      await guardedSync();
    },
    [persist, guardedSync],
  );

  const value = useMemo<DataState>(
    () => ({
      loading,
      refreshing,
      error,
      pendingCount: queue.length,
      serverWon,
      products,
      settings,
      notificationsDenied,

      refresh: async () => {
        setRefreshing(true);
        await guardedSync();
        setRefreshing(false);
      },

      addProduct: async (draft) => {
        const at = new Date().toISOString();
        const op: QueueOp = {
          op: 'create',
          productId: draft.id ?? randomUUID(),
          at,
          draft,
        };
        await changeLocally(op, applyLocal(latest.current.products, op, at));
      },

      updateProduct: async (id, patch) => {
        const existing = latest.current.products.find((item) => item.id === id);
        if (!existing) {
          setError('Продукт не найден.');
          return;
        }
        const at = new Date().toISOString();
        const op: QueueOp = {
          op: 'update',
          productId: id,
          at,
          draft: { ...draftOf(existing), ...patch },
        };
        await changeLocally(op, applyLocal(latest.current.products, op, at));
      },

      removeProduct: async (id) => {
        const at = new Date().toISOString();
        const op: QueueOp = { op: 'delete', productId: id, at };
        await changeLocally(op, applyLocal(latest.current.products, op, at));
      },

      saveSettings: async (draft) => {
        const saved = await client.saveSettings(draft);
        await persist({ settings: saved });
        setSettings(saved);
        setError(null);
      },
    }),
    [
      loading,
      refreshing,
      error,
      serverWon,
      products,
      settings,
      queue.length,
      notificationsDenied,
      guardedSync,
      persist,
      client,
      changeLocally,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const value = useContext(DataContext);
  if (!value) {
    throw new Error('useData вызван вне DataProvider');
  }
  return value;
}
