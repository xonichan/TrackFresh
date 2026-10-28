import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authHeaders, deleteProfileByUid, startApi } from './helpers.js';

const uid = 'uid-settings-test';

type Settings = { notify_frequency: string; notify_time: string; warn_days: number };

test('первое чтение отдаёт значения по умолчанию', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uid);

    const res = await fetch(`${api.base}/settings`, { headers: authHeaders(uid) });
    assert.equal(res.status, 200);

    const body = (await res.json()) as Settings;
    assert.equal(body.notify_frequency, 'daily');
    assert.equal(body.notify_time, '09:00');
    assert.equal(body.warn_days, 3);
  } finally {
    await deleteProfileByUid(api.pool, uid);
    await api.close();
  }
});

test('обновление настроек сохраняется', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uid);

    const put = await fetch(`${api.base}/settings`, {
      method: 'PUT',
      headers: authHeaders(uid),
      body: JSON.stringify({ notifyFrequency: 'weekly', notifyTime: '07:30', warnDays: 7 }),
    });
    assert.equal(put.status, 200);

    const updated = (await put.json()) as Settings;
    assert.equal(updated.notify_frequency, 'weekly');
    assert.equal(updated.notify_time, '07:30');
    assert.equal(updated.warn_days, 7);

    const res = await fetch(`${api.base}/settings`, { headers: authHeaders(uid) });
    const body = (await res.json()) as Settings;
    assert.deepEqual(body, updated);
  } finally {
    await deleteProfileByUid(api.pool, uid);
    await api.close();
  }
});

test('некорректные настройки отклоняются с 422', async () => {
  const api = await startApi();
  try {
    await deleteProfileByUid(api.pool, uid);

    const res = await fetch(`${api.base}/settings`, {
      method: 'PUT',
      headers: authHeaders(uid),
      body: JSON.stringify({ notifyFrequency: 'hourly', notifyTime: '25:99', warnDays: -1 }),
    });
    assert.equal(res.status, 422);
  } finally {
    await deleteProfileByUid(api.pool, uid);
    await api.close();
  }
});
