/** Общий вид пользователя: нативный и веб-вариант входа приводят к нему. */
export type AuthUser = {
  uid: string;
};

/**
 * Интерфейс входа, одинаковый для телефона и браузера.
 * Реализации: `AuthContext.native.tsx` и `AuthContext.web.tsx`.
 */
export type AuthState = {
  /** false, пока состояние входа не определено. */
  ready: boolean;
  user: AuthUser | null;
  error: string | null;
  busy: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  /** ID-токен для запросов к API; пустая строка, если пользователь вышел. */
  getToken(): Promise<string>;
};
