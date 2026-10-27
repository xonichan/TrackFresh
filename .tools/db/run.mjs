import { readFileSync, existsSync } from 'node:fs';
import pg from 'pg';

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('usage: node run.mjs <sql-file>');
  process.exit(2);
}

let password = process.env.PGPASSWORD;
if (!password && process.env.PGPASS_FILE && existsSync(process.env.PGPASS_FILE)) {
  password = readFileSync(process.env.PGPASS_FILE, 'utf8').replace(/\r?\n$/, '');
}

const client = new pg.Client({
  host: process.env.PGHOST ?? '192.168.3.69',
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? 'mydb',
  user: process.env.PGUSER ?? 'trackfresh',
  password,
  connectionTimeoutMillis: 8000,
});

client.on('notice', (n) => console.log('NOTICE:', n.message));

const sql = readFileSync(sqlFile, 'utf8');

try {
  await client.connect();
  const result = await client.query(sql);
  const results = Array.isArray(result) ? result : [result];
  for (const r of results) {
    if (r.rows && r.rows.length > 0) {
      console.log(JSON.stringify(r.rows, null, 2));
    }
  }
  console.log('DONE');
  process.exitCode = 0;
} catch (error) {
  console.error('SQL ERROR:', error.code ?? '', error.message);
  if (error.constraint) console.error('constraint:', error.constraint);
  process.exitCode = 1;
} finally {
  try { await client.end(); } catch {}
}
