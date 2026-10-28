import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testPool } from './helpers.js';
import { withUser } from '../src/db.js';

test('соединение с базой устанавливается', async () => {
  const pool = testPool();
  try {
    const result = await pool.query<{ db: string }>('SELECT current_database() AS db');
    assert.equal(result.rows[0]?.db, process.env.PGDATABASE);
  } finally {
    await pool.end();
  }
});

test('app.user_id действует только внутри транзакции', async () => {
  const pool = testPool();
  const userId = '11111111-1111-1111-1111-111111111111';
  try {
    const inside = await withUser(pool, userId, async (client) => {
      const result = await client.query<{ value: string | null }>(
        "SELECT current_setting('app.user_id', true) AS value",
      );
      return result.rows[0]?.value;
    });
    assert.equal(inside, userId);

    const outside = await pool.query<{ value: string | null }>(
      "SELECT current_setting('app.user_id', true) AS value",
    );
    assert.ok(!outside.rows[0]?.value);
  } finally {
    await pool.end();
  }
});
