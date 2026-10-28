import express, { type Express } from 'express';
import type { Pool } from 'pg';
import { authenticate, type TokenVerifier } from './auth.js';
import { errorHandler } from './errors.js';
import { resolveProfile } from './profile.js';
import { createProductsRouter } from './routes/products.js';
import { createSettingsRouter } from './routes/settings.js';

export type AppDeps = {
  verifier: TokenVerifier;
  db: Pool;
};

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const guard = [authenticate(deps.verifier), resolveProfile(deps.db)];

  app.use('/products', ...guard, createProductsRouter(deps.db));
  app.use('/settings', ...guard, createSettingsRouter(deps.db));

  app.use(errorHandler);

  return app;
}
