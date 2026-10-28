import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authHeaders, deleteProfileByUid, startApi } from './helpers.js';

const uid = 'uid-dates-test';

test('календарные даты возвращаются без сдвига по часовому поясу', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uid);

    const created = await fetch(`${api.base}/products`, {
      method: 'POST',
      headers: authHeaders(uid),
      body: JSON.stringify({
        name: 'Даты',
        category: 'medicine',
        expiryDate: '2027-01-01',
        productionDate: '2026-01-01',
      }),
    });
    assert.equal(created.status, 201);

    const createdBody = (await created.json()) as {
      expiry_date: string;
      production_date: string | null;
    };
    assert.equal(createdBody.expiry_date, '2027-01-01');
    assert.equal(createdBody.production_date, '2026-01-01');

    const list = await fetch(`${api.base}/products`, { headers: authHeaders(uid) });
    const rows = (await list.json()) as Array<{
      expiry_date: string;
      production_date: string | null;
    }>;

    assert.equal(rows[0]?.expiry_date, '2027-01-01');
    assert.equal(rows[0]?.production_date, '2026-01-01');
  } finally {
    await deleteProfileByUid(api.pool, uid);
    await api.close();
  }
});

test('срок годности первого дня месяца не смещается к предыдущему', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uid);

    await fetch(`${api.base}/products`, {
      method: 'POST',
      headers: authHeaders(uid),
      body: JSON.stringify({ name: 'Первое число', category: 'food', expiryDate: '2026-11-01' }),
    });

    const list = await fetch(`${api.base}/products`, { headers: authHeaders(uid) });
    const rows = (await list.json()) as Array<{ expiry_date: string }>;
    assert.equal(rows[0]?.expiry_date, '2026-11-01');
  } finally {
    await deleteProfileByUid(api.pool, uid);
    await api.close();
  }
});
