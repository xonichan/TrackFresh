import type { NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';

declare module 'express-serve-static-core' {
  interface Request {
    profileId?: string;
  }
}

/** Находит профиль по идентификатору Firebase или создаёт его. */
export async function resolveProfileId(db: Pool, firebaseUid: string): Promise<string> {
  const existing = await db.query<{ id: string }>(
    'SELECT id FROM users WHERE firebase_uid = $1',
    [firebaseUid],
  );

  const found = existing.rows[0];
  if (found) {
    return found.id;
  }

  const inserted = await db.query<{ id: string }>(
    `INSERT INTO users (firebase_uid)
     VALUES ($1)
     ON CONFLICT (firebase_uid) DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid
     RETURNING id`,
    [firebaseUid],
  );

  return inserted.rows[0]!.id;
}

export function resolveProfile(db: Pool) {
  // Привязка пользователя к Firebase неизменна, поэтому кэш живёт без TTL.
  const cache = new Map<string, string>();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const uid = req.firebaseUid;
    if (!uid) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    try {
      let profileId = cache.get(uid);
      if (!profileId) {
        profileId = await resolveProfileId(db, uid);
        cache.set(uid, profileId);
      }
      req.profileId = profileId;
      next();
    } catch (error) {
      next(error);
    }
  };
}
