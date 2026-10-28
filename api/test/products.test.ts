import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authHeaders, deleteProfileByUid, startApi } from './helpers.js';

const uid = 'uid-products-test';

test('создание корректного продукта возвращает идентификатор', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uid);

    const res = await fetch(`${api.base}/products`, {
      method: 'POST',
      headers: authHeaders(uid),
      body: JSON.stringify({ name: 'Молоко', category: 'food', expiryDate: '2026-11-01' }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as { id?: string; name?: string; expiry_date?: string };
    assert.ok(body.id);
    assert.equal(body.name, 'Молоко');
    assert.equal(body.expiry_date, '2026-11-01');
  } finally {
    await deleteProfileByUid(api.pool, uid);
    await api.close();
  }
});

test('недопустимая категория отклоняется с 422', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uid);

    const res = await fetch(`${api.base}/products`, {
      method: 'POST',
      headers: authHeaders(uid),
      body: JSON.stringify({ name: 'Странное', category: 'other', expiryDate: '2026-11-01' }),
    });

    assert.equal(res.status, 422);
  } finally {
    await deleteProfileByUid(api.pool, uid);
    await api.close();
  }
});

test('дата производства позже срока годности отклоняется с 422', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uid);

    const res = await fetch(`${api.base}/products`, {
      method: 'POST',
      headers: authHeaders(uid),
      body: JSON.stringify({
        name: 'Инверсия',
        category: 'food',
        expiryDate: '2026-11-01',
        productionDate: '2026-12-01',
      }),
    });

    assert.equal(res.status, 422);
  } finally {
    await deleteProfileByUid(api.pool, uid);
    await api.close();
  }
});

test('список продуктов упорядочен по сроку годности', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uid);

    const create = (name: string, expiryDate: string) =>
      fetch(`${api.base}/products`, {
        method: 'POST',
        headers: authHeaders(uid),
        body: JSON.stringify({ name, category: 'food', expiryDate }),
      });

    await create('Поздний', '2026-12-20');
    await create('Ранний', '2026-10-25');
    await create('Средний', '2026-11-10');

    const res = await fetch(`${api.base}/products`, { headers: authHeaders(uid) });
    assert.equal(res.status, 200);

    const rows = (await res.json()) as Array<{ name: string; expiry_date: string }>;
    assert.deepEqual(
      rows.map((row) => row.name),
      ['Ранний', 'Средний', 'Поздний'],
    );
  } finally {
    await deleteProfileByUid(api.pool, uid);
    await api.close();
  }
});
