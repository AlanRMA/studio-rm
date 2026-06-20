import fs from 'node:fs';
import { config } from '../config.js';
import { closePostgres, deleteReceipt, listReceipts } from '../db/postgres.js';

async function cleanAll() {
  if (!config.databaseUrl) {
    console.error('DATABASE_URL não configurada.');
    process.exit(1);
  }

  if (config.appEnv === 'production' && process.argv[2] !== '--confirm-prod') {
    console.error(
      'Limpeza em PRODUÇÃO bloqueada. Use: npm run clean:prod -- --confirm-prod'
    );
    process.exit(1);
  }

  console.log(`Limpando ${config.receiptsTable} (${config.appEnv})...`);

  const receipts = await listReceipts(5000);
  for (const row of receipts) {
    await deleteReceipt(row.event_id as string);
  }

  if (fs.existsSync(config.sqlitePath)) {
    fs.writeFileSync(
      config.sqlitePath,
      JSON.stringify({ nextId: 1, pending: [], recent_events: [] }, null, 2)
    );
    console.log('Fila local limpa.');
  }

  console.log(`\nLimpeza concluída. ${receipts.length} registro(s) removido(s).`);
  await closePostgres();
}

cleanAll().catch((error) => {
  console.error('Erro na limpeza:', error);
  process.exit(1);
});