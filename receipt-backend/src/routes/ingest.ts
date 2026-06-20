import { Router, type Request, type Response } from 'express';
import { config } from '../config.js';
import type { ReceiptQueue } from '../db/queue.js';
import {
  checkPostgresConnection,
  deleteReceipt,
  getReceipt,
  isPostgresConfigured,
  listReceipts,
  updateReceiptClientName,
} from '../db/postgres.js';
import { ingestReceiptSchema } from '../schemas/receipt.js';
import { flushQueue, ingestReceipt } from '../services/ingest.js';

function authorize(req: Request, res: Response): boolean {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization Bearer obrigatório' });
    return false;
  }

  const token = header.slice('Bearer '.length);
  if (token !== config.ingestApiKey) {
    res.status(401).json({ error: 'API key inválida' });
    return false;
  }

  return true;
}

export function createIngestRouter(queue: ReceiptQueue): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const postgresConfigured = isPostgresConfigured();
    const postgresConnected = postgresConfigured
      ? await checkPostgresConnection()
      : false;

    res.json({
      ok: true,
      app_env: config.appEnv,
      schema: config.schema,
      table: config.receiptsTable,
      responsavel: config.responsavel,
      postgres: {
        configured: postgresConfigured,
        connected: postgresConnected,
      },
      queue: {
        pending: queue.pendingCount(),
      },
    });
  });

  router.post('/rosania/receipt', async (req, res) => {
    if (!authorize(req, res)) return;

    const idempotencyKey = req.header('x-idempotency-key');
    const parsed = ingestReceiptSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: 'Payload inválido',
        details: parsed.error.flatten(),
      });
      return;
    }

    if (idempotencyKey && idempotencyKey !== parsed.data.event_id) {
      res.status(400).json({
        error: 'X-Idempotency-Key deve ser igual a event_id',
      });
      return;
    }

    try {
      const result = await ingestReceipt(parsed.data, queue);

      if (result.status === 'duplicate') {
        res.status(409).json({ error: result.message });
        return;
      }

      if (result.status === 'idempotent') {
        res.status(200).json({
          ok: true,
          status: 'idempotent',
          event_id: parsed.data.event_id,
        });
        return;
      }

      res.status(result.queued ? 202 : 201).json({
        ok: true,
        status: result.queued ? 'queued' : 'ingested',
        event_id: parsed.data.event_id,
        queued: result.queued,
      });
    } catch (error) {
      console.error('[ingest] Erro inesperado:', error);
      res.status(500).json({ error: 'Erro interno ao ingerir recibo' });
    }
  });

  router.post('/flush', async (req, res) => {
    if (!authorize(req, res)) return;

    const flushed = await flushQueue(queue);
    res.json({ ok: true, flushed, pending: queue.pendingCount() });
  });

  // Endpoints de teste manual (CRUD) — protegidos por API key
  router.get('/rosania/receipts', async (req, res) => {
    if (!authorize(req, res)) return;

    try {
      const limit = Math.min(Number(req.query.limit ?? 20), 100);
      const receipts = await listReceipts(limit);
      res.json({ ok: true, count: receipts.length, receipts });
    } catch (error) {
      console.error('[read] Erro ao listar:', error);
      res.status(503).json({ error: 'Postgres indisponível ou tabela não criada' });
    }
  });

  router.get('/rosania/receipts/:eventId', async (req, res) => {
    if (!authorize(req, res)) return;

    try {
      const receipt = await getReceipt(req.params.eventId);
      if (!receipt) {
        res.status(404).json({ error: 'Recibo não encontrado' });
        return;
      }
      res.json({ ok: true, receipt });
    } catch (error) {
      console.error('[read] Erro ao buscar:', error);
      res.status(503).json({ error: 'Postgres indisponível' });
    }
  });

  router.patch('/rosania/receipts/:eventId', async (req, res) => {
    if (!authorize(req, res)) return;

    const clientName = req.body?.client_name;
    if (!clientName || typeof clientName !== 'string') {
      res.status(400).json({ error: 'Campo client_name é obrigatório' });
      return;
    }

    try {
      const updated = await updateReceiptClientName(req.params.eventId, clientName.trim());
      if (!updated) {
        res.status(404).json({ error: 'Recibo não encontrado' });
        return;
      }
      res.json({ ok: true, receipt: updated });
    } catch (error) {
      console.error('[update] Erro:', error);
      res.status(503).json({ error: 'Postgres indisponível' });
    }
  });

  router.delete('/rosania/receipts/:eventId', async (req, res) => {
    if (!authorize(req, res)) return;

    try {
      const deleted = await deleteReceipt(req.params.eventId);
      if (!deleted) {
        res.status(404).json({ error: 'Recibo não encontrado' });
        return;
      }
      res.json({ ok: true, deleted: req.params.eventId });
    } catch (error) {
      console.error('[delete] Erro:', error);
      res.status(503).json({ error: 'Postgres indisponível' });
    }
  });

  return router;
}