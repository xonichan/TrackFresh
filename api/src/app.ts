import express, { type Express } from 'express';
import path from 'node:path';
import type { Pool } from 'pg';
import { authenticate, type TokenVerifier } from './auth.js';
import { errorHandler } from './errors.js';
import { resolveProfile } from './profile.js';
import { createProductsRouter } from './routes/products.js';
import { createSettingsRouter } from './routes/settings.js';

export type AppDeps = {
  verifier: TokenVerifier;
  db: Pool;
  /** Каталог собранной веб-версии. Если не задан, файлы интерфейса не раздаются. */
  webDir?: string;
};

/** Пути, которые всегда отвечают данными и никогда — страницей интерфейса. */
const DATA_PREFIXES = ['/health', '/products', '/settings'];

function isDataPath(urlPath: string): boolean {
  return DATA_PREFIXES.some(
    (prefix) => urlPath === prefix || urlPath.startsWith(`${prefix}/`),
  );
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const guard = [authenticate(deps.verifier), resolveProfile(deps.db)];

  app.use('/products', ...guard, createProductsRouter(deps.db));
  app.use('/settings', ...guard, createSettingsRouter(deps.db));

  // Путь данных, до которого не дошёл ни один маршрут (например, GET /products/:id),
  // должен отвечать данными, а не страницей интерфейса.
  app.use((req, res, next) => {
    if (!isDataPath(req.path)) {
      next();
      return;
    }
    res.status(404).json({ error: 'not_found' });
  });

  if (deps.webDir) {
    app.use(express.static(deps.webDir, { index: 'index.html' }));

    // Клиентские маршруты интерфейса: только GET и только вне путей данных,
    // иначе несуществующий продукт вернул бы страницу вместо «не найдено».
    app.use((req, res, next) => {
      if (req.method !== 'GET' || isDataPath(req.path)) {
        next();
        return;
      }
      res.sendFile(path.join(deps.webDir!, 'index.html'), (error) => {
        if (error) {
          next();
        }
      });
    });
  }

  app.use(errorHandler);

  return app;
}
