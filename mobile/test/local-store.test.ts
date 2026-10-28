import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalStore, type KeyValueStorage } from '../src/lib/local-store';
import type { Product } from '../src/api/types';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data = new Map(Object.entries(initial));
  return {
    async getItem(key) {
      return data.get(key) ?? null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
  };
}

const product: Product = {
  id: 'p1',
  name: 'Молоко',
  category: 'food',
  expiry_date: '2026-11-01',
  production_date: null,
  updated_at: '2026-10-28T10:00:00.000Z',
};

test('записанные продукты читаются обратно', async () => {
  const store = createLocalStore(memoryStorage());
  assert.equal(await store.readProducts(), null);

  await store.writeProducts([product]);
  assert.deepEqual(await store.readProducts(), [product]);
});

test('настройки и очередь хранятся отдельно от продуктов', async () => {
  const storage = memoryStorage();
  const store = createLocalStore(storage);

  await store.writeSettings({ notify_frequency: 'weekly', notify_time: '07:30', warn_days: 7 });
  await store.writeQueue([{ op: 'delete', productId: 'p1', at: '2026-10-28T10:00:00.000Z' }]);

  assert.equal(await store.readProducts(), null);
  assert.equal((await store.readSettings())?.warn_days, 7);
  assert.equal((await store.readQueue()).length, 1);
});

test('пустая очередь читается как пустой массив', async () => {
  const store = createLocalStore(memoryStorage());
  assert.deepEqual(await store.readQueue(), []);
});

test('битый JSON не роняет чтение', async () => {
  const store = createLocalStore(
    memoryStorage({
      'trackfresh.products': '{это не json',
      'trackfresh.queue': 'null',
    }),
  );

  assert.equal(await store.readProducts(), null);
  assert.deepEqual(await store.readQueue(), []);
});
