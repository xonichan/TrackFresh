import Constants from 'expo-constants';

type Extra = {
  apiBaseUrl?: string;
  googleWebClientId?: string;
  firebaseWeb?: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    appId?: string;
  };
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** Внешний или локальный адрес API. Меняется в app.json -> expo.extra.apiBaseUrl. */
export const API_BASE_URL = extra.apiBaseUrl ?? 'http://192.168.3.69:3000';

/** Web client ID из Firebase Console, нужен для Google Sign-In на телефоне. */
export const GOOGLE_WEB_CLIENT_ID = extra.googleWebClientId ?? '';

/**
 * Ключи Firebase для браузера. На телефоне настройки берутся из google-services.json,
 * в браузере — только отсюда: своего файла конфигурации у веб-сборки нет.
 */
export function firebaseWebConfig(): Record<string, string> | null {
  const config = extra.firebaseWeb;
  if (!config?.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    return null;
  }
  return {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    appId: config.appId,
  };
}
