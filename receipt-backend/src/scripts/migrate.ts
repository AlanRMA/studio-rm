import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config, type AppEnv } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type SchemaName = 'dev' | 'prod';

function loadTableSql(schema: SchemaName): string {
  const templatePath = path.resolve(__dirname, '../../migrations/receipts_table.sql');
  return fs.readFileSync(templatePath, 'utf8').replaceAll('{{SCHEMA}}', schema);
}

async function migrateSchema(pool: pg.Pool, schema: SchemaName) {
  await pool.query(loadTableSql(schema));
  console.log(`Tabela ${schema}.rosania_receipts pronta.`);
}

export async function migrate(target?: AppEnv): Promise<void> {
  if (!config.databaseUrl) {
    throw new Error('Configure DATABASE_URL no .env antes de rodar migrate.');
  }

  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes('supabase')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    const schemas: SchemaName[] =
      target === 'production'
        ? ['prod']
        : target === 'development'
          ? ['dev']
          : ['dev', 'prod'];

    for (const schema of schemas) {
      await migrateSchema(pool, schema);
    }

    const legacyPath = path.resolve(__dirname, '../../migrations/003_split_dev_prod.sql');
    if (fs.existsSync(legacyPath)) {
      await pool.query(fs.readFileSync(legacyPath, 'utf8'));
      console.log('Migração legada public → prod aplicada (se existia).');
    }
  } finally {
    await pool.end();
  }
}

const arg = process.argv[2];
const target =
  arg === 'production' || arg === 'prod'
    ? 'production'
    : arg === 'development' || arg === 'dev'
      ? 'development'
      : arg === 'all'
        ? undefined
        : (process.env.APP_ENV === 'production' ? 'production' : 'development');

const isMain = process.argv[1]?.includes('migrate.ts');
if (isMain) {
  migrate(target).catch((error) => {
    console.error('Falha na migration:', error);
    process.exit(1);
  });
}