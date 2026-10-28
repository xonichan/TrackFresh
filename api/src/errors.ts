import type { NextFunction, Request, Response } from 'express';

type PgError = { code?: string };
type HttpError = { status?: number; statusCode?: number };

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Ошибки разбора тела (express.json) приходят с status/statusCode 4xx.
  const http = (error ?? {}) as HttpError;
  const status = http.status ?? http.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: 'bad_request' });
    return;
  }

  const { code } = (error ?? {}) as PgError;

  if (code === '23514' || code === '23502') {
    res.status(422).json({ error: 'validation_failed' });
    return;
  }

  if (code === '23505') {
    res.status(409).json({ error: 'conflict' });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'internal_error' });
}
