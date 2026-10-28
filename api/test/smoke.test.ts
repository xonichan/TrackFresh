import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import type { TokenVerifier } from '../src/auth.js';
import { testPool } from './helpers.js';

const unusedVerifier: TokenVerifier = {
  async verifyIdToken() {
    throw new Error('verifier is not used by /health');
  },
};

test('GET /health returns ok', async () => {
  const pool = testPool();
  const server = createApp({ verifier: unusedVerifier, db: pool }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const res = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
