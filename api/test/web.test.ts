import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { authHeaders, deleteProfileByUid, startApi } from './helpers.js';

const uid = 'uid-web-test';
const PAGE = '<!doctype html><title>TrackFresh</title><div id="root"></div>';

/** Каталог с собранной страницей: index.html и один файл ресурса. */
async function fakeWebDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tf-web-'));
  await writeFile(path.join(dir, 'index.html'), PAGE);
  await writeFile(path.join(dir, 'app.js'), 'console.log("hello")');
  return dir;
}

test('главная страница отдаётся с корневого адреса', async () => {
  const webDir = await fakeWebDir();
  const api = await startApi({ webDir });
  try {
    const res = await fetch(`${api.base}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /TrackFresh/);

    const asset = await fetch(`${api.base}/app.js`);
    assert.equal(asset.status, 200);
  } finally {
    await api.close();
    await rm(webDir, { recursive: true, force: true });
  }
});

test('клиентский маршрут отдаёт страницу, а не ошибку', async () => {
  const webDir = await fakeWebDir();
  const api = await startApi({ webDir });
  try {
    const res = await fetch(`${api.base}/some/client/route`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /TrackFresh/);
  } finally {
    await api.close();
    await rm(webDir, { recursive: true, force: true });
  }
});

test('маршруты данных не перехватываются страницей', async () => {
  const webDir = await fakeWebDir();
  const api = await startApi({ webDir });
  try {
    await deleteProfileByUid(api.pool, uid);

    // Без токена — ответ данных, а не страница.
    const unauthorized = await fetch(`${api.base}/products`);
    assert.equal(unauthorized.status, 401);
    assert.equal((await unauthorized.json() as { error: string }).error, 'unauthorized');

    // Существующий маршрут отдаёт данные.
    const list = await fetch(`${api.base}/products`, { headers: authHeaders(uid) });
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(await list.json()));

    // Несуществующий продукт — прежнее «не найдено», а не страница.
    const missing = await fetch(
      `${api.base}/products/00000000-0000-4000-8000-000000000000`,
      { headers: authHeaders(uid) },
    );
    assert.equal(missing.status, 404);
    assert.equal((await missing.json() as { error: string }).error, 'not_found');
  } finally {
    await deleteProfileByUid(api.pool, uid);
    await api.close();
    await rm(webDir, { recursive: true, force: true });
  }
});

test('не-GET запрос на неизвестный путь не получает страницу', async () => {
  const webDir = await fakeWebDir();
  const api = await startApi({ webDir });
  try {
    const res = await fetch(`${api.base}/unknown`, { method: 'POST' });
    assert.equal(res.status, 404);
    assert.doesNotMatch(await res.text(), /TrackFresh/);
  } finally {
    await api.close();
    await rm(webDir, { recursive: true, force: true });
  }
});
