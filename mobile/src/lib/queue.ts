import type { Product, ProductDraft } from '../api/types';

/** Операция, которую нужно отправить на сервер. */
export type QueueOp = {
  op: 'create' | 'update' | 'delete';
  productId: string;
  /** Время локального изменения, ISO 8601. По нему разрешается конфликт. */
  at: string;
  draft?: ProductDraft;
};

/** Что делать с операцией после ответа сервера. */
export type Outcome = 'done' | 'retry' | 'failed';

export function enqueue(queue: QueueOp[], op: QueueOp): QueueOp[] {
  return compact([...queue, op]);
}

/**
 * Схлопывает операции по одному продукту:
 * create + update -> create с новыми полями; create + delete -> ничего;
 * update + delete -> delete; несколько update -> последний.
 */
export function compact(queue: QueueOp[]): QueueOp[] {
  const byProduct = new Map<string, QueueOp[]>();

  for (const op of queue) {
    const operations = byProduct.get(op.productId) ?? [];
    operations.push(op);
    byProduct.set(op.productId, operations);
  }

  const result: QueueOp[] = [];

  for (const operations of byProduct.values()) {
    const create = operations.find((item) => item.op === 'create');
    const remove = operations.find((item) => item.op === 'delete');
    const lastUpdate = [...operations].reverse().find((item) => item.op === 'update');

    if (create) {
      if (remove) {
        continue; // продукт не покидал устройство
      }
      result.push(
        lastUpdate ? { ...create, draft: lastUpdate.draft, at: lastUpdate.at } : create,
      );
      continue;
    }

    if (remove) {
      result.push(remove);
      continue;
    }

    if (lastUpdate) {
      result.push(lastUpdate);
    }
  }

  return result;
}

/**
 * Применяет операцию к локальному списку, чтобы экран сразу показывал результат.
 * Время серверного изменения не затираем: оно нужно для разрешения конфликтов.
 */
export function applyLocal(products: Product[], op: QueueOp, at: string): Product[] {
  if (op.op === 'delete') {
    return products.filter((item) => item.id !== op.productId);
  }

  const draft = op.draft;
  if (!draft) {
    return products;
  }

  const existing = products.find((item) => item.id === op.productId);

  if (!existing) {
    if (op.op !== 'create') {
      return products;
    }
    // У созданного на устройстве продукта серверного времени ещё нет.
    return [
      {
        id: op.productId,
        name: draft.name,
        category: draft.category,
        expiry_date: draft.expiryDate,
        production_date: draft.productionDate,
        updated_at: at,
      },
      ...products,
    ];
  }

  return products.map((item) =>
    item.id === op.productId
      ? {
          ...item,
          name: draft.name,
          category: draft.category,
          expiry_date: draft.expiryDate,
          production_date: draft.productionDate,
        }
      : item,
  );
}

/**
 * Классифицирует ответ сервера. Ответы, означающие «на сервере уже так»,
 * считаются выполнением, иначе очередь застрянет навсегда.
 */
export function classifyOutcome(op: QueueOp, status: number): Outcome {
  if (status >= 200 && status < 300) {
    return 'done';
  }

  if (status === 404) {
    // Продукт удалён на другом устройстве: отправлять правку больше некуда.
    return 'done';
  }

  if (status === 409 && op.op === 'create') {
    return 'done';
  }

  if (status === 422 || status === 400) {
    return 'failed';
  }

  // 401, 5xx и отсутствие ответа — пробуем позже.
  return 'retry';
}

/**
 * «Побеждает последний»: применяем локальную правку, только если она позже
 * серверного изменения. Если серверной версии нет, правка уходит всегда.
 */
export function isLocalNewer(localAt: string, serverUpdatedAt: string | null): boolean {
  if (!serverUpdatedAt) {
    return true;
  }
  return Date.parse(localAt) > Date.parse(serverUpdatedAt);
}

/** Разница, после которой расхождение часов заметно человеку. */
export const CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Признак, что серверная версия ушла вперёд сильнее, чем можно объяснить
 * задержкой: скорее всего часы устройства врут. Тогда честнее показать,
 * что данные пришли с сервера.
 */
export function serverAheadBeyondSkew(
  localAt: string,
  serverUpdatedAt: string | null,
): boolean {
  if (!serverUpdatedAt) {
    return false;
  }
  return Date.parse(serverUpdatedAt) - Date.parse(localAt) > CLOCK_SKEW_MS;
}
