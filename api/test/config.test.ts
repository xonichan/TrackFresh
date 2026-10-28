import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigError, loadConfig } from '../src/config.js';

test('loadConfig сообщает, какая переменная не задана', () => {
  assert.throws(
    () => loadConfig({}),
    (error: unknown) =>
      error instanceof ConfigError && /PGHOST/.test(error.message),
  );
});

test('loadConfig собирает конфигурацию из окружения', () => {
  const config = loadConfig({
    PGHOST: 'localhost',
    PGDATABASE: 'mydb',
    PGUSER: 'trackfresh',
    PGPASSWORD: 'secret',
    FIREBASE_PROJECT_ID: 'project',
    FIREBASE_CLIENT_EMAIL: 'service@project.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: 'line1\\nline2',
  });

  assert.equal(config.port, 3000);
  assert.equal(config.db.database, 'mydb');
  assert.equal(config.firebase.privateKey, 'line1\nline2');
});
