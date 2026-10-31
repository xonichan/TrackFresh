import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
} from 'firebase/auth';
import { firebaseWebConfig } from '../config';
import type { AuthState } from './auth-types';

const AuthContext = createContext<AuthState | null>(null);

function messageOf(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password')) {
    return 'Неверная почта или пароль.';
  }
  if (code.includes('email-already-in-use')) {
    return 'Такая почта уже зарегистрирована.';
  }
  if (code.includes('invalid-email')) {
    return 'Проверьте адрес почты.';
  }
  if (code.includes('weak-password')) {
    return 'Пароль слишком простой.';
  }
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) {
    return 'Вход через Google отменён.';
  }
  if (code.includes('network-request-failed')) {
    return 'Нет связи с Firebase. Проверьте подключение.';
  }
  return 'Не удалось выполнить вход.';
}

/** Ключи Firebase не заданы: вход не заработает, но страница не должна падать. */
const NOT_CONFIGURED = 'Вход не настроен: в app.json не заполнен expo.extra.firebaseWeb.';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // initializeApp повторно вызывать нельзя, поэтому берём уже созданное приложение.
  const { auth, configError } = useMemo<{ auth: Auth | null; configError: string | null }>(() => {
    const config = firebaseWebConfig();
    if (!config) {
      return { auth: null, configError: NOT_CONFIGURED };
    }
    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    return { auth: getAuth(app), configError: null };
  }, []);

  const [ready, setReady] = useState(!auth);
  const [user, setUser] = useState<AuthState['user']>(null);
  const [error, setError] = useState<string | null>(configError);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth) {
      return;
    }
    return onAuthStateChanged(auth, (next) => {
      setUser(next ? { uid: next.uid } : null);
      setReady(true);
    });
  }, [auth]);

  const run = useCallback(
    async (work: () => Promise<unknown>) => {
      if (!auth) {
        setError(NOT_CONFIGURED);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await work();
      } catch (caught) {
        setError(messageOf(caught));
      } finally {
        setBusy(false);
      }
    },
    [auth],
  );

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      error,
      busy,

      signIn: (email, password) =>
        run(() => signInWithEmailAndPassword(auth!, email.trim(), password)),

      signUp: (email, password) =>
        run(() => createUserWithEmailAndPassword(auth!, email.trim(), password)),

      signInWithGoogle: () =>
        run(async () => {
          const provider = new GoogleAuthProvider();
          await signInWithPopup(auth!, provider);
        }),

      signOut: () => run(() => firebaseSignOut(auth!)),

      getToken: async () => {
        const current = auth?.currentUser;
        if (!current) {
          return '';
        }
        return current.getIdToken();
      },
    }),
    [auth, ready, user, error, busy, run],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth вызван вне AuthProvider');
  }
  return value;
}
