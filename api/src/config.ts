export type DbConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

export type FirebaseConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

export type Config = {
  port: number;
  db: DbConfig;
  firebase: FirebaseConfig;
};

export class ConfigError extends Error {}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (value === undefined || value.trim() === '') {
    throw new ConfigError(`не задана переменная окружения ${name}`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 3000),
    db: {
      host: required(env, 'PGHOST'),
      port: Number(env.PGPORT ?? 5432),
      database: required(env, 'PGDATABASE'),
      user: required(env, 'PGUSER'),
      password: required(env, 'PGPASSWORD'),
    },
    firebase: {
      projectId: required(env, 'FIREBASE_PROJECT_ID'),
      clientEmail: required(env, 'FIREBASE_CLIENT_EMAIL'),
      privateKey: required(env, 'FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    },
  };
}
