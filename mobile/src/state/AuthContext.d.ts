import type React from 'react';
import type { AuthState } from './auth-types';

// Типы поверхности для платформенных реализаций (AuthContext.native.tsx, AuthContext.web.tsx).
// Metro выбирает файл по платформе, tsc — это объявление.
export declare function AuthProvider(props: { children: React.ReactNode }): React.JSX.Element;
export declare function useAuth(): AuthState;
