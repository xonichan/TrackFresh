import { ConfigError, loadConfig } from './config.js';
import { createPool } from './db.js';
import { createFirebaseVerifier } from './firebase.js';
import { createApp } from './app.js';

try {
  const config = loadConfig();
  const db = createPool(config.db);
  const verifier = createFirebaseVerifier(config.firebase);

  createApp({ verifier, db, webDir: config.webDir }).listen(config.port, () => {
    console.log(`trackfresh-api listening on ${config.port}`);
  });
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(`Ошибка конфигурации: ${error.message}`);
    process.exit(1);
  }
  throw error;
}
