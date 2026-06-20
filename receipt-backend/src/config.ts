import 'dotenv/config';
import path from 'node:path';

export type AppEnv = 'development' | 'production';

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function resolveAppEnv(): AppEnv {
  return process.env.APP_ENV === 'production' ? 'production' : 'development';
}

const appEnv = resolveAppEnv();
const schema = appEnv === 'production' ? 'prod' : 'dev';

export const config = {
  appEnv,
  schema,
  receiptsTable: `${schema}.rosania_receipts`,
  port: Number(process.env.PORT ?? 4000),
  ingestApiKey: requireEnv('INGEST_API_KEY', 'dev-key-change-me'),
  databaseUrl: process.env.DATABASE_URL ?? '',
  duplicateWindowMs: Number(process.env.DUPLICATE_WINDOW_MS ?? 5000),
  flushIntervalMs: Number(process.env.FLUSH_INTERVAL_MS ?? 10000),
  sqlitePath: path.resolve(
    process.env.SQLITE_PATH ?? `./data/receipt-queue-${schema}.json`
  ),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  responsavel: 'Rosania' as const,
};