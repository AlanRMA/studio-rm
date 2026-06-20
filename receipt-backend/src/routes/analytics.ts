import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import {
  getClientOptions,
  getRevenueTrend,
  getSummary,
  getTopClients,
  type Granularity,
} from '../db/analytics.js';
import { getDecisionInsights } from '../db/insights.js';
import { checkPostgresConnection, isPostgresConfigured } from '../db/postgres.js';

const filtersSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  client: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

function authorize(req: Request, res: Response): boolean {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization Bearer obrigatório' });
    return false;
  }

  if (header.slice('Bearer '.length) !== config.ingestApiKey) {
    res.status(401).json({ error: 'API key inválida' });
    return false;
  }

  return true;
}

function parseFilters(req: Request, res: Response) {
  const parsed = filtersSchema.safeParse({
    from: req.query.from,
    to: req.query.to,
    client: req.query.client || undefined,
    limit: req.query.limit,
  });

  if (!parsed.success) {
    res.status(400).json({
      error: 'Parâmetros inválidos. Use from/to no formato yyyy-MM-dd.',
      details: parsed.error.flatten(),
    });
    return null;
  }

  if (parsed.data.from > parsed.data.to) {
    res.status(400).json({ error: 'A data "from" deve ser anterior ou igual a "to".' });
    return null;
  }

  return parsed.data;
}

export function createAnalyticsRouter(): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const configured = isPostgresConfigured();
    const connected = configured ? await checkPostgresConnection() : false;
    res.json({ ok: true, postgres: { configured, connected } });
  });

  router.get('/summary', async (req, res) => {
    if (!authorize(req, res)) return;
    const filters = parseFilters(req, res);
    if (!filters) return;

    try {
      const summary = await getSummary(filters);
      res.json({ ok: true, filters, summary });
    } catch (error) {
      console.error('[analytics/summary]', error);
      res.status(503).json({ error: 'Falha ao consultar analytics' });
    }
  });

  router.get('/top-clients', async (req, res) => {
    if (!authorize(req, res)) return;
    const filters = parseFilters(req, res);
    if (!filters) return;

    const sort = req.query.sort === 'revenue' ? 'revenue' : 'count';

    try {
      const clients = await getTopClients(filters, sort);
      res.json({ ok: true, filters, sort, clients });
    } catch (error) {
      console.error('[analytics/top-clients]', error);
      res.status(503).json({ error: 'Falha ao consultar analytics' });
    }
  });

  router.get('/revenue-trend', async (req, res) => {
    if (!authorize(req, res)) return;
    const filters = parseFilters(req, res);
    if (!filters) return;

    const granularity = (['day', 'week', 'month'].includes(String(req.query.granularity))
      ? req.query.granularity
      : 'day') as Granularity;

    try {
      const trend = await getRevenueTrend(filters, granularity);
      res.json({ ok: true, filters, granularity, trend });
    } catch (error) {
      console.error('[analytics/revenue-trend]', error);
      res.status(503).json({ error: 'Falha ao consultar analytics' });
    }
  });

  router.get('/clients', async (req, res) => {
    if (!authorize(req, res)) return;
    const filters = parseFilters(req, res);
    if (!filters) return;

    try {
      const clients = await getClientOptions(filters);
      res.json({ ok: true, filters, clients });
    } catch (error) {
      console.error('[analytics/clients]', error);
      res.status(503).json({ error: 'Falha ao consultar analytics' });
    }
  });

  router.get('/decisions', async (req, res) => {
    if (!authorize(req, res)) return;
    const filters = parseFilters(req, res);
    if (!filters) return;

    try {
      const insights = await getDecisionInsights(filters);
      res.json({ ok: true, filters, ...insights });
    } catch (error) {
      console.error('[analytics/decisions]', error);
      res.status(503).json({ error: 'Falha ao consultar insights' });
    }
  });

  return router;
}