import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testPool } from './helpers.js';
import { resolveProfileId } from '../src/profile.js';
import { withUser } from '../src/db.js';

const uidA = 'uid-iso-a';
const uidB = 'uid-iso-b';

test('профиль видит только свои строки', async () => {
  const db = testPool();
  try {
    await db.query('DELETE FROM users WHERE firebase_uid = ANY($1)', [[uidA, uidB]]);
    const a = await resolveProfileId(db, uidA);
    const b = await resolveProfileId(db, uidB);

    await withUser(db, a, (client) =>
      client.query(
        "INSERT INTO products (user_id, name, category, expiry_date) VALUES ($1, 'Продукт-A', 'food', '2026-11-01')",
        [a],
      ),
    );
    await withUser(db, b, (client) =>
      client.query(
        "INSERT INTO products (user_id, name, category, expiry_date) VALUES ($1, 'Продукт-B', 'food', '2026-11-02')",
        [b],
      ),
    );

    const seenByA = await withUser(db, a, (client) =>
      client.query<{ name: string }>('SELECT name FROM products ORDER BY name'),
    );
    assert.deepEqual(
      seenByA.rows.map((row) => row.name),
      ['Продукт-A'],
    );

    const seenByB = await withUser(db, b, (client) =>
      client.query<{ name: string }>('SELECT name FROM products ORDER BY name'),
    );
    assert.deepEqual(
      seenByB.rows.map((row) => row.name),
      ['Продукт-B'],
    );
  } finally {
    await db.query('DELETE FROM users WHERE firebase_uid = ANY($1)', [[uidA, uidB]]);
    await db.end();
  }
});
