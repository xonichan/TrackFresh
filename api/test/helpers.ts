import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { createApp } from '../src/app.js';
import type { TokenVerifier } from '../src/auth.js';
import { createPool } from '../src/db.js';

export function testPool(): Pool {
  const missing = ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'].filter(
    (name) => !process.env[name],
  );
  if (missing.length > 0) {
    throw new Error(`Для тестов БД задайте переменные: ${missing.join(', ')}`);
  }

  return createPool({
    host: process.env.PGHOST!,
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE!,
    user: process.env.PGUSER!,
    password: process.env.PGPASSWORD!,
  });
}

/** В тестах токен равен идентификатору Firebase. */
export const uidVerifier: TokenVerifier = {
  async verifyIdToken(token: string) {
    return { uid: token };
  },
};

export type ApiHandle = {
  base: string;
  pool: Pool;
  close: () => Promise<void>;
};

export async function startApi(options: { webDir?: string } = {}): Promise<ApiHandle> {
  const pool = testPool();
  const server = createApp({ verifier: uidVerifier, db: pool, webDir: options.webDir }).listen(0);
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  return {
    base: `http://127.0.0.1:${address.port}`,
    pool,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await pool.end();
    },
  };
}

export async function deleteProfileByUid(pool: Pool, uid: string): Promise<void> {
  await pool.query('DELETE FROM users WHERE firebase_uid = $1', [uid]);
}

export function authHeaders(uid: string): Record<string, string> {
  return { authorization: `Bearer ${uid}`, 'content-type': 'application/json' };
}
