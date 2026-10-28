import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authHeaders, deleteProfileByUid, startApi } from './helpers.js';

const uid = 'uid-validation-test';

async function postProduct(base: string, body: unknown): Promise<Response> {
  return fetch(`${base}/products`, {
    method: 'POST',
    headers: authHeaders(uid),
    body: JSON.stringify(body),
  });
}

test('несуществующая календарная дата отклоняется с 422, а не 500', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uid);

    const feb30 = await postProduct(api.base, {
      name: 'Тридцатое февраля',
      category: 'food',
      expiryDate: '2026-02-30',
    });
    assert.equal(feb30.status, 422);

    const month99 = await postProduct(api.base, {
      name: 'Месяц 99',
      category: 'food',
      expiryDate: '2026-99-99',
    });
    assert.equal(month99.status, 422);
  } finally {
    await deleteProfileByUid(api.pool, uid);
    await api.close();
  }
});

test('реальная дата по-прежнему принимается', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uid);

    const leap = await postProduct(api.base, {
      name: 'Високосный',
      category: 'food',
      expiryDate: '2028-02-29',
    });
    assert.equal(leap.status, 201);
  } finally {
    await deleteProfileByUid(api.pool, uid);
    await api.close();
  }
});

test('битый JSON в теле отвечает 400, а не 500', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uid);

    const res = await fetch(`${api.base}/products`, {
      method: 'POST',
      headers: authHeaders(uid),
      body: '{"name": ',
    });

    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'bad_request' });
  } finally {
    await deleteProfileByUid(api.pool, uid);
    await api.close();
  }
});
