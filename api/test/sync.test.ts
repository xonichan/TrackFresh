import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authHeaders, deleteProfileByUid, startApi } from './helpers.js';

const uidA = 'uid-sync-a';
const uidB = 'uid-sync-b';

const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type Product = {
  id: string;
  name: string;
  expiry_date: string;
  updated_at: string;
};

test('ответы продуктов содержат updated_at в ISO 8601', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uidA);

    const created = await fetch(`${api.base}/products`, {
      method: 'POST',
      headers: authHeaders(uidA),
      body: JSON.stringify({ name: 'Кефир', category: 'food', expiryDate: '2026-11-05' }),
    });
    assert.equal(created.status, 201);
    const product = (await created.json()) as Product;
    assert.match(product.updated_at, ISO_WITH_ZONE);

    const list = await fetch(`${api.base}/products`, { headers: authHeaders(uidA) });
    const rows = (await list.json()) as Product[];
    assert.match(rows[0]!.updated_at, ISO_WITH_ZONE);

    // Время изменения должно расти после правки.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const patched = await fetch(`${api.base}/products/${product.id}`, {
      method: 'PATCH',
      headers: authHeaders(uidA),
      body: JSON.stringify({ name: 'Кефир 1%' }),
    });
    assert.equal(patched.status, 200);
    const after = (await patched.json()) as Product;
    assert.ok(
      after.updated_at > product.updated_at,
      `ожидали рост updated_at: ${product.updated_at} -> ${after.updated_at}`,
    );
  } finally {
    await deleteProfileByUid(api.pool, uidA);
    await api.close();
  }
});

test('создание с id клиента идемпотентно', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uidA);

    const id = '3f1a9c1e-0a0b-4c2d-8e3f-111122223333';
    const body = JSON.stringify({
      id,
      name: 'Молоко',
      category: 'food',
      expiryDate: '2026-11-01',
    });

    const first = await fetch(`${api.base}/products`, {
      method: 'POST',
      headers: authHeaders(uidA),
      body,
    });
    assert.equal(first.status, 201);
    assert.equal(((await first.json()) as Product).id, id);

    const repeat = await fetch(`${api.base}/products`, {
      method: 'POST',
      headers: authHeaders(uidA),
      body,
    });
    assert.equal(repeat.status, 200);
    assert.equal(((await repeat.json()) as Product).id, id);

    const list = await fetch(`${api.base}/products`, { headers: authHeaders(uidA) });
    const rows = (await list.json()) as Product[];
    assert.equal(rows.filter((row) => row.id === id).length, 1);
  } finally {
    await deleteProfileByUid(api.pool, uidA);
    await api.close();
  }
});

test('чужой id при создании даёт 409', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uidA);
    await deleteProfileByUid(api.pool, uidB);

    const id = '3f1a9c1e-0a0b-4c2d-8e3f-444455556666';
    const body = JSON.stringify({
      id,
      name: 'Чужой',
      category: 'food',
      expiryDate: '2026-11-01',
    });

    const owner = await fetch(`${api.base}/products`, {
      method: 'POST',
      headers: authHeaders(uidB),
      body,
    });
    assert.equal(owner.status, 201);

    const intruder = await fetch(`${api.base}/products`, {
      method: 'POST',
      headers: authHeaders(uidA),
      body,
    });
    assert.equal(intruder.status, 409);

    // Данные владельца не изменились.
    const list = await fetch(`${api.base}/products`, { headers: authHeaders(uidB) });
    const rows = (await list.json()) as Product[];
    assert.equal(rows[0]?.name, 'Чужой');
  } finally {
    await deleteProfileByUid(api.pool, uidA);
    await deleteProfileByUid(api.pool, uidB);
    await api.close();
  }
});

test('некорректный id отклоняется с 422', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uidA);

    const res = await fetch(`${api.base}/products`, {
      method: 'POST',
      headers: authHeaders(uidA),
      body: JSON.stringify({
        id: 'not-a-uuid',
        name: 'Молоко',
        category: 'food',
        expiryDate: '2026-11-01',
      }),
    });
    assert.equal(res.status, 422);
  } finally {
    await deleteProfileByUid(api.pool, uidA);
    await api.close();
  }
});
