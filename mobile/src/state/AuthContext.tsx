import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from '@react-native-firebase/auth';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '../config';

type AuthState = {
  /** false, пока Firebase не сообщил текущее состояние входа. */
  ready: boolean;
  user: User | null;
  error: string | null;
  busy: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  /** ID-токен для запросов к API; пустая строка, если пользователь вышел. */
  getToken(): Promise<string>;
};

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
  if (code.includes('network-request-failed')) {
    return 'Нет связи с Firebase. Проверьте подключение.';
  }
  return 'Не удалось выполнить вход.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useMemo(() => getAuth(), []);

  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (GOOGLE_WEB_CLIENT_ID) {
      GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setReady(true);
    });
  }, [auth]);

  const run = useCallback(async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      error,
      busy,

      signIn: (email, password) =>
        run(() => signInWithEmailAndPassword(auth, email.trim(), password)),

      signUp: (email, password) =>
        run(() => createUserWithEmailAndPassword(auth, email.trim(), password)),

      signInWithGoogle: () =>
        run(async () => {
          await GoogleSignin.hasPlayServices();
          const response = await GoogleSignin.signIn();

          if (!isSuccessResponse(response)) {
            return;
          }

          const idToken = response.data.idToken;
          if (!idToken) {
            throw new Error('Google не вернул idToken');
          }

          await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
        }),

      signOut: () => run(() => firebaseSignOut(auth)),

      getToken: async () => {
        const current = auth.currentUser;
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
