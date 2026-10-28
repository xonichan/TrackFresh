import { Router } from 'express';
import type { Pool } from 'pg';
import { withUser } from '../db.js';
import { isUuid, parseProductInput, parseProductPatch } from '../validation.js';

const PRODUCT_COLUMNS = `
  id,
  name,
  category,
  to_char(expiry_date, 'YYYY-MM-DD') AS expiry_date,
  to_char(production_date, 'YYYY-MM-DD') AS production_date,
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at
`;

export function createProductsRouter(db: Pool): Router {
  const router = Router();

  router.post('/', async (req, res, next) => {
    const parsed = parseProductInput(req.body);
    if (!parsed.ok) {
      res.status(422).json({ error: 'validation_failed', details: parsed.details });
      return;
    }

    const { id, name, category, expiryDate, productionDate } = parsed.value;

    try {
      // Без id продукт создаётся как обычно.
      if (!id) {
        const created = await withUser(db, req.profileId!, (client) =>
          client.query(
            `INSERT INTO products (user_id, name, category, expiry_date, production_date)
             VALUES ($1, $2, $3, $4::date, $5::date)
             RETURNING ${PRODUCT_COLUMNS}`,
            [req.profileId, name, category, expiryDate, productionDate],
          ),
        );

        res.status(201).json(created.rows[0]);
        return;
      }

      // С id клиента создание идемпотентно: повтор возвращает тот же продукт.
      const result = await withUser(db, req.profileId!, async (client) => {
        const inserted = await client.query(
          `INSERT INTO products (id, user_id, name, category, expiry_date, production_date)
           VALUES ($1, $2, $3, $4, $5::date, $6::date)
           ON CONFLICT (id) DO NOTHING
           RETURNING ${PRODUCT_COLUMNS}`,
          [id, req.profileId, name, category, expiryDate, productionDate],
        );

        if (inserted.rows[0]) {
          return { status: 201, row: inserted.rows[0] };
        }

        const existing = await client.query(
          `SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = $1`,
          [id],
        );

        return existing.rows[0]
          ? { status: 200, row: existing.rows[0] }
          : { status: 409, row: null };
      });

      if (result.status === 409) {
        res.status(409).json({ error: 'conflict' });
        return;
      }

      res.status(result.status).json(result.row);
    } catch (error) {
      next(error);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const result = await withUser(db, req.profileId!, (client) =>
        client.query(
          `SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY expiry_date, name`,
        ),
      );

      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    const { id } = req.params;
    if (!isUuid(id)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const parsed = parseProductPatch(req.body);
    if (!parsed.ok) {
      res.status(422).json({ error: 'validation_failed', details: parsed.details });
      return;
    }

    const sets: string[] = [];
    const values: unknown[] = [];

    const patch = parsed.value;
    if (patch.name !== undefined) {
      values.push(patch.name);
      sets.push(`name = $${values.length}`);
    }
    if (patch.category !== undefined) {
      values.push(patch.category);
      sets.push(`category = $${values.length}`);
    }
    if (patch.expiryDate !== undefined) {
      values.push(patch.expiryDate);
      sets.push(`expiry_date = $${values.length}::date`);
    }
    if (patch.productionDate !== undefined) {
      values.push(patch.productionDate);
      sets.push(`production_date = $${values.length}::date`);
    }

    values.push(id);

    try {
      const updated = await withUser(db, req.profileId!, (client) =>
        client.query(
          `UPDATE products
           SET ${sets.join(', ')}, updated_at = now()
           WHERE id = $${values.length}
           RETURNING ${PRODUCT_COLUMNS}`,
          values,
        ),
      );

      const row = updated.rows[0];
      if (!row) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      res.json(row);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    const { id } = req.params;
    if (!isUuid(id)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    try {
      const deleted = await withUser(db, req.profileId!, (client) =>
        client.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]),
      );

      if (!deleted.rows[0]) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
