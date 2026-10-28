import type { Product, Settings } from '../api/types';
import type { QueueOp } from './queue';

/** Минимум, который нужен от хранилища: AsyncStorage в приложении, память в тестах. */
export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

const KEYS = {
  products: 'trackfresh.products',
  settings: 'trackfresh.settings',
  queue: 'trackfresh.queue',
} as const;

export function createLocalStore(storage: KeyValueStorage) {
  async function readJson<T>(key: string): Promise<T | null> {
    const raw = await storage.getItem(key);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Битые данные не должны ронять приложение: считаем, что их нет.
      return null;
    }
  }

  return {
    readProducts: () => readJson<Product[]>(KEYS.products),
    writeProducts: (products: Product[]) =>
      storage.setItem(KEYS.products, JSON.stringify(products)),

    readSettings: () => readJson<Settings>(KEYS.settings),
    writeSettings: (settings: Settings) =>
      storage.setItem(KEYS.settings, JSON.stringify(settings)),

    readQueue: async () => (await readJson<QueueOp[]>(KEYS.queue)) ?? [],
    writeQueue: (queue: QueueOp[]) =>
      storage.setItem(KEYS.queue, JSON.stringify(queue)),
  };
}

export type LocalStore = ReturnType<typeof createLocalStore>;
