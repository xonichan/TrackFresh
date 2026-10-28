import type { NextFunction, Request, Response } from 'express';

export type VerifiedUser = { uid: string };

export type TokenVerifier = {
  verifyIdToken(token: string): Promise<VerifiedUser>;
};

declare module 'express-serve-static-core' {
  interface Request {
    firebaseUid?: string;
  }
}

export function authenticate(verifier: TokenVerifier) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.header('authorization') ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    try {
      const user = await verifier.verifyIdToken(token);
      req.firebaseUid = user.uid;
      next();
    } catch {
      res.status(401).json({ error: 'unauthorized' });
    }
  };
}
