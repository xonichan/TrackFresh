import { Router } from 'express';
import type { Pool } from 'pg';
import { withUser } from '../db.js';
import { parseSettingsInput } from '../validation.js';

const SETTINGS_COLUMNS = `
  notify_frequency,
  to_char(notify_time, 'HH24:MI') AS notify_time,
  warn_days
`;

export function createSettingsRouter(db: Pool): Router {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const result = await withUser(db, req.profileId!, async (client) => {
        await client.query(
          'INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
          [req.profileId],
        );
        return client.query(`SELECT ${SETTINGS_COLUMNS} FROM user_settings`);
      });

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.put('/', async (req, res, next) => {
    const parsed = parseSettingsInput(req.body);
    if (!parsed.ok) {
      res.status(422).json({ error: 'validation_failed', details: parsed.details });
      return;
    }

    const { notifyFrequency, notifyTime, warnDays } = parsed.value;

    try {
      const result = await withUser(db, req.profileId!, (client) =>
        client.query(
          `INSERT INTO user_settings (user_id, notify_frequency, notify_time, warn_days)
           VALUES ($1, $2, $3::time, $4)
           ON CONFLICT (user_id) DO UPDATE
             SET notify_frequency = EXCLUDED.notify_frequency,
                 notify_time = EXCLUDED.notify_time,
                 warn_days = EXCLUDED.warn_days
           RETURNING ${SETTINGS_COLUMNS}`,
          [req.profileId, notifyFrequency, notifyTime, warnDays],
        ),
      );

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
