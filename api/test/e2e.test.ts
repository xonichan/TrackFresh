import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authHeaders, deleteProfileByUid, startApi } from './helpers.js';

const uid = 'uid-e2e-test';

test('сквозной сценарий: вход, продукт, настройки, удаление', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uid);

    // Вход: первое обращение создаёт профиль по идентификатору Firebase.
    const firstList = await fetch(`${api.base}/products`, { headers: authHeaders(uid) });
    assert.equal(firstList.status, 200);
    assert.deepEqual(await firstList.json(), []);

    // Создание продукта.
    const created = await fetch(`${api.base}/products`, {
      method: 'POST',
      headers: authHeaders(uid),
      body: JSON.stringify({
        name: 'Кефир',
        category: 'food',
        expiryDate: '2026-11-05',
        productionDate: '2026-10-05',
      }),
    });
    assert.equal(created.status, 201);
    const product = (await created.json()) as { id: string; name: string };
    assert.ok(product.id);

    // Список.
    const list = await fetch(`${api.base}/products`, { headers: authHeaders(uid) });
    const listed = (await list.json()) as Array<{ name: string }>;
    assert.deepEqual(
      listed.map((row) => row.name),
      ['Кефир'],
    );

    // Изменение.
    const patched = await fetch(`${api.base}/products/${product.id}`, {
      method: 'PATCH',
      headers: authHeaders(uid),
      body: JSON.stringify({ name: 'Кефир 1%' }),
    });
    assert.equal(patched.status, 200);

    // Настройки.
    const savedSettings = await fetch(`${api.base}/settings`, {
      method: 'PUT',
      headers: authHeaders(uid),
      body: JSON.stringify({ notifyFrequency: 'every_3_days', notifyTime: '08:15', warnDays: 5 }),
    });
    assert.equal(savedSettings.status, 200);

    const readSettings = await fetch(`${api.base}/settings`, { headers: authHeaders(uid) });
    const settings = (await readSettings.json()) as {
      notify_frequency: string;
      notify_time: string;
      warn_days: number;
    };
    assert.equal(settings.notify_frequency, 'every_3_days');
    assert.equal(settings.notify_time, '08:15');
    assert.equal(settings.warn_days, 5);

    // Удаление.
    const deleted = await fetch(`${api.base}/products/${product.id}`, {
      method: 'DELETE',
      headers: authHeaders(uid),
    });
    assert.equal(deleted.status, 204);

    const afterDelete = await fetch(`${api.base}/products`, { headers: authHeaders(uid) });
    assert.deepEqual(await afterDelete.json(), []);
  } finally {
    // Проверка очистки: удаление профиля уносит продукты и настройки.
    await deleteProfileByUid(api.pool, uid);

    const leftover = await api.pool.query<{ users: string; products: string; settings: string }>(
      `SELECT
         (SELECT count(*) FROM users WHERE firebase_uid = $1) AS users,
         (SELECT count(*) FROM products p JOIN users u ON u.id = p.user_id WHERE u.firebase_uid = $1) AS products,
         (SELECT count(*) FROM user_settings s JOIN users u ON u.id = s.user_id WHERE u.firebase_uid = $1) AS settings`,
      [uid],
    );
    assert.deepEqual(leftover.rows[0], { users: '0', products: '0', settings: '0' });

    await api.close();
  }
});
