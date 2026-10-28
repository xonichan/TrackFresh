import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import type { TokenVerifier } from '../src/auth.js';
import { testPool } from './helpers.js';

const verifier: TokenVerifier = {
  async verifyIdToken(token: string) {
    if (token === 'good-token') {
      return { uid: 'uid-auth-test' };
    }
    throw new Error('invalid token');
  },
};

async function withServer(run: (base: string) => Promise<void>): Promise<void> {
  const pool = testPool();
  const server = createApp({ verifier, db: pool }).listen(0);
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
}

test('запрос без токена отвечает 401', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/products`);
    assert.equal(res.status, 401);
  });
});

test('запрос с недействительным токеном отвечает 401', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/products`, {
      headers: { authorization: 'Bearer broken' },
    });
    assert.equal(res.status, 401);
  });
});

test('запрос с действительным токеном не отвечает 401', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/products`, {
      headers: { authorization: 'Bearer good-token' },
    });
    assert.notEqual(res.status, 401);
  });
});

test('настройки также защищены токеном', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/settings`);
    assert.equal(res.status, 401);
  });
});
