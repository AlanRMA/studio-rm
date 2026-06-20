import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { ReceiptQueue } from './db/queue.js';
import { closePostgres } from './db/postgres.js';
import { createAnalyticsRouter } from './routes/analytics.js';
import { createIngestRouter } from './routes/ingest.js';
import { flushQueue } from './services/ingest.js';

const app = express();
const queue = new ReceiptQueue();

app.use(
  cors({
    origin: config.allowedOrigins.length > 0 ? config.allowedOrigins : true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);
app.use(express.json({ limit: '1mb' }));

app.use('/api/v1/ingest', createIngestRouter(queue));
app.use('/api/v1/analytics/rosania', createAnalyticsRouter());

app.get('/', (_req, res) => {
  res.json({
    service: 'receipt-backend',
    app_env: config.appEnv,
    schema: config.schema,
    table: config.receiptsTable,
    responsavel: config.responsavel,
    endpoints: {
      health: '/api/v1/ingest/health',
      ingest: 'POST /api/v1/ingest/rosania/receipt',
      analytics: '/api/v1/analytics/rosania',
    },
  });
});

const flushTimer = setInterval(() => {
  flushQueue(queue).catch((error) => {
    console.error('[flush] Erro no worker:', error);
  });
}, config.flushIntervalMs);

const server = app.listen(config.port, () => {
  console.log(`receipt-backend rodando em http://localhost:${config.port}`);
  if (!config.databaseUrl) {
    console.warn(
      '[aviso] DATABASE_URL não configurada — recibos serão apenas enfileirados localmente'
    );
  }
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[erro] Porta ${config.port} já está em uso. Encerre o processo anterior com:\n` +
        `  lsof -i :${config.port} -t | xargs kill\n` +
        `Ou altere PORT no .env para outra porta (ex: 4001).`
    );
    process.exit(1);
  }
  throw error;
});

async function shutdown() {
  clearInterval(flushTimer);
  server.close();
  await closePostgres();
  queue.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);