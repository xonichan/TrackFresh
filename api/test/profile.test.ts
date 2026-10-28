import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testPool } from './helpers.js';
import { resolveProfileId } from '../src/profile.js';

const uid = 'uid-profile-test';

test('профиль создаётся при первом обращении и переиспользуется дальше', async () => {
  const db = testPool();
  try {
    await db.query('DELETE FROM users WHERE firebase_uid = $1', [uid]);

    const first = await resolveProfileId(db, uid);
    assert.ok(first);

    const second = await resolveProfileId(db, uid);
    assert.equal(second, first);

    const count = await db.query<{ n: string }>(
      'SELECT count(*) AS n FROM users WHERE firebase_uid = $1',
      [uid],
    );
    assert.equal(count.rows[0]?.n, '1');
  } finally {
    await db.query('DELETE FROM users WHERE firebase_uid = $1', [uid]);
    await db.end();
  }
});
