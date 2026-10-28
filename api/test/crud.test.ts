import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authHeaders, deleteProfileByUid, startApi } from './helpers.js';

const uidA = 'uid-crud-a';
const uidB = 'uid-crud-b';

type StartedApi = Awaited<ReturnType<typeof startApi>>;

async function createProduct(api: StartedApi, uid: string, name: string): Promise<string> {
  const res = await fetch(`${api.base}/products`, {
    method: 'POST',
    headers: authHeaders(uid),
    body: JSON.stringify({ name, category: 'food', expiryDate: '2026-11-01' }),
  });
  assert.equal(res.status, 201);
  const body = (await res.json()) as { id: string };
  return body.id;
}

test('свой продукт изменяется и удаляется', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uidA);
    const id = await createProduct(api, uidA, 'Молоко');

    const patched = await fetch(`${api.base}/products/${id}`, {
      method: 'PATCH',
      headers: authHeaders(uidA),
      body: JSON.stringify({ name: 'Молоко 2.5%' }),
    });
    assert.equal(patched.status, 200);
    const patchedBody = (await patched.json()) as { name: string };
    assert.equal(patchedBody.name, 'Молоко 2.5%');

    const deleted = await fetch(`${api.base}/products/${id}`, {
      method: 'DELETE',
      headers: authHeaders(uidA),
    });
    assert.equal(deleted.status, 204);

    const list = await fetch(`${api.base}/products`, { headers: authHeaders(uidA) });
    assert.deepEqual(await list.json(), []);
  } finally {
    await deleteProfileByUid(api.pool, uidA);
    await deleteProfileByUid(api.pool, uidB);
    await api.close();
  }
});

test('чужой продукт не изменяется и не удаляется', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uidA);
    await deleteProfileByUid(api.pool, uidB);

    const foreignId = await createProduct(api, uidB, 'Чужой продукт');

    const patched = await fetch(`${api.base}/products/${foreignId}`, {
      method: 'PATCH',
      headers: authHeaders(uidA),
      body: JSON.stringify({ name: 'Взлом' }),
    });
    assert.equal(patched.status, 404);

    const deleted = await fetch(`${api.base}/products/${foreignId}`, {
      method: 'DELETE',
      headers: authHeaders(uidA),
    });
    assert.equal(deleted.status, 404);

    const list = await fetch(`${api.base}/products`, { headers: authHeaders(uidB) });
    const rows = (await list.json()) as Array<{ name: string }>;
    assert.deepEqual(
      rows.map((row) => row.name),
      ['Чужой продукт'],
    );
  } finally {
    await deleteProfileByUid(api.pool, uidA);
    await deleteProfileByUid(api.pool, uidB);
    await api.close();
  }
});

test('несуществующий продукт отвечает 404', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uidA);

    const res = await fetch(
      `${api.base}/products/00000000-0000-4000-8000-000000000000`,
      { method: 'DELETE', headers: authHeaders(uidA) },
    );
    assert.equal(res.status, 404);

    const invalid = await fetch(`${api.base}/products/not-a-uuid`, {
      method: 'DELETE',
      headers: authHeaders(uidA),
    });
    assert.equal(invalid.status, 404);
  } finally {
    await deleteProfileByUid(api.pool, uidA);
    await api.close();
  }
});

test('изменение нескольких полей сразу и очистка даты производства', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uidA);

    const created = await fetch(`${api.base}/products`, {
      method: 'POST',
      headers: authHeaders(uidA),
      body: JSON.stringify({
        name: 'Аспирин',
        category: 'food',
        expiryDate: '2026-11-01',
        productionDate: '2026-10-01',
      }),
    });
    assert.equal(created.status, 201);
    const { id } = (await created.json()) as { id: string };

    const patched = await fetch(`${api.base}/products/${id}`, {
      method: 'PATCH',
      headers: authHeaders(uidA),
      body: JSON.stringify({
        name: 'Аспирин 500',
        category: 'medicine',
        expiryDate: '2026-12-01',
        productionDate: null,
      }),
    });
    assert.equal(patched.status, 200);

    const body = (await patched.json()) as Record<string, unknown>;
    const { updated_at, ...fields } = body;
    assert.ok(typeof updated_at === 'string');
    assert.deepEqual(fields, {
      id,
      name: 'Аспирин 500',
      category: 'medicine',
      expiry_date: '2026-12-01',
      production_date: null,
    });
  } finally {
    await deleteProfileByUid(api.pool, uidA);
    await api.close();
  }
});
