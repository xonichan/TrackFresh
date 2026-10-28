import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, type ApiClient } from '../src/api/client';
import type { Product, Settings } from '../src/api/types';
import { runQueue } from '../src/lib/sync';
import type { QueueOp } from '../src/lib/queue';

const at = (hour: number) => `2026-10-28T${String(hour).padStart(2, '0')}:00:00.000Z`;

const draft = {
  name: 'Молоко',
  category: 'food' as const,
  expiryDate: '2026-11-01',
  productionDate: null,
};

function serverProduct(updatedAt: string, name = 'Молоко'): Product {
  return {
    id: 'p1',
    name,
    category: 'food',
    expiry_date: '2026-11-01',
    production_date: null,
    updated_at: updatedAt,
  };
}

type Calls = string[];

/** create и update возвращают продукт, delete ничего не возвращает. */
function fakeClient(
  respond: (kind: 'create' | 'update', id?: string) => Promise<Product>,
  calls: Calls,
): ApiClient {
  return {
    listProducts: async () => [],
    createProduct: async (productDraft) => {
      calls.push(`create:${productDraft.id}`);
      return respond('create', productDraft.id);
    },
    updateProduct: async (id) => {
      calls.push(`update:${id}`);
      return respond('update', id);
    },
    deleteProduct: async (id) => {
      calls.push(`delete:${id}`);
    },
    getSettings: async () => ({}) as Settings,
    saveSettings: async () => ({}) as Settings,
  };
}

test('успешная отправка очищает очередь и берёт серверную версию', async () => {
  const calls: Calls = [];
  const queue: QueueOp[] = [{ op: 'update', productId: 'p1', at: at(11), draft }];

  const client = fakeClient(async () => serverProduct(at(12), 'Молоко с сервера'), calls);

  const outcome = await runQueue(queue, [serverProduct(at(10))], client);

  assert.deepEqual(calls, ['update:p1']);
  assert.deepEqual(outcome.queue, []);
  assert.equal(outcome.pushed, 1);
  assert.equal(outcome.products[0]!.name, 'Молоко с сервера');
});

test('сетевая ошибка оставляет очередь и прерывает проход', async () => {
  const calls: Calls = [];
  const queue: QueueOp[] = [
    { op: 'update', productId: 'p1', at: at(11), draft },
    { op: 'delete', productId: 'p2', at: at(11) },
  ];

  const client = fakeClient(async () => {
    throw new ApiError(0, 'network');
  }, calls);

  const outcome = await runQueue(queue, [serverProduct(at(10))], client);

  assert.equal(outcome.stoppedByNetwork, true);
  assert.equal(outcome.queue.length, 2, 'очередь не должна теряться');
  assert.equal(calls.length, 1, 'после сбоя второй запрос не отправляем');
});

test('серверная версия новее — правка отбрасывается', async () => {
  const calls: Calls = [];
  const queue: QueueOp[] = [{ op: 'update', productId: 'p1', at: at(10), draft }];

  const client = fakeClient(async () => serverProduct(at(11)), calls);

  const outcome = await runQueue(queue, [serverProduct(at(11))], client);

  assert.deepEqual(calls, [], 'отправлять нечего');
  assert.deepEqual(outcome.queue, []);
  assert.equal(outcome.dropped, 1);
});

test('заметное расхождение часов отмечается', async () => {
  const client = fakeClient(async () => {
    throw new ApiError(0, 'network');
  }, []);

  const outcome = await runQueue(
    [{ op: 'update', productId: 'p1', at: at(10), draft }],
    [serverProduct('2026-10-28T10:30:00.000Z')],
    client,
  );

  assert.deepEqual(outcome.serverWonProductIds, ['p1']);
});

test('отклонённая сервером операция снимается с причиной', async () => {
  const calls: Calls = [];
  const queue: QueueOp[] = [{ op: 'update', productId: 'p1', at: at(11), draft }];

  const client = fakeClient(async () => {
    throw new ApiError(422, 'validation_failed', ['category должен быть food или medicine']);
  }, calls);

  const outcome = await runQueue(queue, [serverProduct(at(10))], client);

  assert.deepEqual(outcome.queue, []);
  assert.equal(outcome.rejected.length, 1);
  assert.match(outcome.rejected[0]!.message, /category/);
  assert.equal(outcome.stoppedByNetwork, false);
});

test('404 при изменении считается выполнением и убирает продукт', async () => {
  const calls: Calls = [];
  const queue: QueueOp[] = [{ op: 'update', productId: 'p1', at: at(11), draft }];

  const client = fakeClient(async () => {
    throw new ApiError(404, 'not_found');
  }, calls);

  const outcome = await runQueue(queue, [serverProduct(at(10))], client);

  assert.deepEqual(outcome.queue, []);
  assert.equal(outcome.products.length, 0, 'продукт удалён на другом устройстве');
});

test('создание уходит с идентификатором клиента', async () => {
  const calls: Calls = [];
  const queue: QueueOp[] = [{ op: 'create', productId: 'p9', at: at(11), draft }];

  const client = fakeClient(async () => serverProduct(at(11)), calls);

  await runQueue(queue, [], client);

  assert.deepEqual(calls, ['create:p9']);
});

test('409 при создании считается выполнением', async () => {
  const queue: QueueOp[] = [{ op: 'create', productId: 'p9', at: at(11), draft }];
  const client = fakeClient(async () => {
    throw new ApiError(409, 'conflict');
  }, []);

  const outcome = await runQueue(queue, [], client);

  assert.deepEqual(outcome.queue, []);
  assert.equal(outcome.rejected.length, 0);
});
