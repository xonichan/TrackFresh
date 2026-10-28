import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { FirebaseConfig } from './config.js';
import type { TokenVerifier } from './auth.js';

export function createFirebaseVerifier(config: FirebaseConfig): TokenVerifier {
  const app = initializeApp({
    credential: cert({
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      privateKey: config.privateKey,
    }),
  });
  const auth = getAuth(app);

  return {
    async verifyIdToken(token: string) {
      const decoded = await auth.verifyIdToken(token);
      return { uid: decoded.uid };
    },
  };
}
