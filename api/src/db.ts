import { Pool, type PoolClient } from 'pg';
import type { DbConfig } from './config.js';

export function createPool(config: DbConfig): Pool {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: 5,
    // Без таймаута зависший запрос держит соединение из пула бесконечно.
    statement_timeout: 10_000,
  });

  // Без слушателя разрыв простаивающего соединения валит процесс.
  pool.on('error', (error) => {
    console.error('pool client error:', error);
  });

  return pool;
}

/**
 * Выполняет работу в транзакции, в которой выставлен app.user_id.
 * set_config(..., true) действует только до конца транзакции, поэтому
 * значение не «протекает» в следующий запрос из пула соединений.
 */
export async function withUser<T>(
  pool: Pool,
  userId: string,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.user_id', userId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    // Соединение может быть уже мертво; тогда ROLLBACK падает и прячет исходную ошибку.
    try {
      await client.query('ROLLBACK');
    } catch {
      // исходную ошибку сохраняем
    }
    throw error;
  } finally {
    client.release();
  }
}
