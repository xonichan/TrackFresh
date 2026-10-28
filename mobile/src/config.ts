import Constants from 'expo-constants';

type Extra = {
  apiBaseUrl?: string;
  googleWebClientId?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** Внешний или локальный адрес API. Меняется в app.json -> expo.extra.apiBaseUrl. */
export const API_BASE_URL = extra.apiBaseUrl ?? 'http://192.168.3.69:3000';

/** Web client ID из Firebase Console, нужен для Google Sign-In. */
export const GOOGLE_WEB_CLIENT_ID = extra.googleWebClientId ?? '';
