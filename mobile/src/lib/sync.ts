import type { ApiClient } from '../api/client';
import { ApiError } from '../api/client';
import type { Product } from '../api/types';
import { classifyOutcome, isLocalNewer, serverAheadBeyondSkew, type QueueOp } from './queue';

export type SyncOutcome = {
  /** Очередь после прохода: успешные и отклонённые убраны, отложенные остались. */
  queue: QueueOp[];
  products: Product[];
  pushed: number;
  /** Правки, отброшенные потому, что серверная версия новее. */
  dropped: number;
  /** Серверная версия ушла вперёд сильнее, чем объяснимо задержкой. */
  serverWonProductIds: string[];
  /** Операции, которые сервер не примет: их сняли с очереди с причиной. */
  rejected: { op: QueueOp; message: string }[];
  /** Проход прерван сетевой ошибкой; остаток очереди ждёт повтора. */
  stoppedByNetwork: boolean;
};

async function send(client: ApiClient, op: QueueOp): Promise<Product | null> {
  if (op.op === 'create') {
    return client.createProduct({ id: op.productId, ...op.draft! });
  }
  if (op.op === 'update') {
    return client.updateProduct(op.productId, op.draft!);
  }
  await client.deleteProduct(op.productId);
  return null;
}

/**
 * Отправляет накопленные операции по одной.
 * Останавливается на первой сетевой ошибке, чтобы не долбить сервер.
 */
export async function runQueue(
  queue: QueueOp[],
  products: Product[],
  client: ApiClient,
): Promise<SyncOutcome> {
  const remaining: QueueOp[] = [];
  let current = products;
  let pushed = 0;
  let dropped = 0;
  const serverWonProductIds: string[] = [];
  const rejected: { op: QueueOp; message: string }[] = [];
  let stoppedByNetwork = false;

  for (const op of queue) {
    if (stoppedByNetwork) {
      remaining.push(op);
      continue;
    }

    const serverTime = current.find((item) => item.id === op.productId)?.updated_at ?? null;

    // «Побеждает последний»: если серверная версия новее, правку не отправляем.
    if (op.op !== 'create' && !isLocalNewer(op.at, serverTime)) {
      dropped += 1;
      if (serverAheadBeyondSkew(op.at, serverTime)) {
        serverWonProductIds.push(op.productId);
      }
      continue;
    }

    try {
      const saved = await send(client, op);
      pushed += 1;

      if (saved) {
        const known = current.some((item) => item.id === saved.id);
        current = known
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current];
      } else {
        current = current.filter((item) => item.id !== op.productId);
      }
    } catch (caught) {
      const status = caught instanceof ApiError ? caught.status : 0;
      const outcome = classifyOutcome(op, status);

      if (outcome === 'done') {
        // На сервере уже так, как нужно. Если продукта там нет или идентификатор
        // занят другим профилем, локальную копию показывать нельзя.
        if (op.op === 'delete' || status === 404 || status === 409) {
          current = current.filter((item) => item.id !== op.productId);
        }
      } else if (outcome === 'failed') {
        rejected.push({
          op,
          message: caught instanceof ApiError ? caught.userMessage : 'Изменение отклонено.',
        });
      } else {
        // Сеть или сервер недоступны: эта и все следующие операции ждут повтора.
        remaining.push(op);
        stoppedByNetwork = true;
      }
    }
  }

  return {
    queue: remaining,
    products: current,
    pushed,
    dropped,
    serverWonProductIds,
    rejected,
    stoppedByNetwork,
  };
}
