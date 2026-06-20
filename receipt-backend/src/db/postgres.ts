import pg from 'pg';
import { config } from '../config.js';
import type { IngestReceiptPayload } from '../schemas/receipt.js';
import { buildContentHash } from '../services/hash.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function isPostgresConfigured(): boolean {
  return Boolean(config.databaseUrl);
}

export function getPool(): pg.Pool | null {
  if (!config.databaseUrl) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes('supabase')
        ? { rejectUnauthorized: false }
        : undefined,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function checkPostgresConnection(): Promise<boolean> {
  const activePool = getPool();
  if (!activePool) return false;

  try {
    await activePool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function findExistingEvent(eventId: string): Promise<boolean> {
  const activePool = getPool();
  if (!activePool) return false;

  const result = await activePool.query(
    `SELECT 1 FROM ${config.receiptsTable} WHERE event_id = $1`,
    [eventId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function findRapidDuplicate(
  contentHash: string,
  eventAtIso: string,
  windowMs: number
): Promise<{ event_id: string; event_at: Date } | null> {
  const activePool = getPool();
  if (!activePool) return null;

  const cutoff = new Date(new Date(eventAtIso).getTime() - windowMs);
  const result = await activePool.query(
    `SELECT event_id, event_at
     FROM ${config.receiptsTable}
     WHERE responsavel = $1
       AND content_hash = $2
       AND event_at >= $3
     ORDER BY event_at DESC
     LIMIT 1`,
    [config.responsavel, contentHash, cutoff.toISOString()]
  );

  if (!result.rows.length) return null;
  return result.rows[0] as { event_id: string; event_at: Date };
}

export async function insertReceipt(payload: IngestReceiptPayload): Promise<void> {
  const activePool = getPool();
  if (!activePool) {
    throw new Error('Postgres não configurado');
  }

  const { receipt, export: exportMeta, event_id, event_at } = payload;
  const contentHash = buildContentHash(payload);

  await activePool.query(
    `INSERT INTO ${config.receiptsTable} (
      event_id, responsavel, receipt_id, invoice_number, client_name,
      service_type, issue_date, company_name, show_emitter,
      emitter_document_type, emitter_legal_name, emitter_document,
      delivery_fee, adjustment, adjustment_kind,
      subtotal, grand_total, item_count, export_format,
      lines, content_hash, event_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12,
      $13, $14, $15,
      $16, $17, $18, $19,
      $20, $21, $22
    )
    ON CONFLICT (event_id) DO NOTHING`,
    [
      event_id,
      config.responsavel,
      receipt.id,
      receipt.invoice_number,
      receipt.client_name,
      receipt.service_type ?? null,
      receipt.issue_date,
      receipt.company_name,
      receipt.show_emitter,
      receipt.emitter?.document_type ?? null,
      receipt.emitter?.legal_name ?? null,
      receipt.emitter?.document_number ?? null,
      receipt.delivery_fee,
      receipt.adjustment,
      receipt.adjustment_kind,
      receipt.totals.subtotal,
      receipt.totals.grand_total,
      receipt.totals.item_count,
      exportMeta.format,
      JSON.stringify(receipt.lines),
      contentHash,
      event_at,
    ]
  );
}

export async function listReceipts(limit = 20): Promise<Record<string, unknown>[]> {
  const activePool = getPool();
  if (!activePool) throw new Error('Postgres não configurado');

  const result = await activePool.query(
    `SELECT event_id, responsavel, client_name, grand_total, issue_date, export_format, ingested_at
     FROM ${config.receiptsTable}
     WHERE responsavel = $1
     ORDER BY ingested_at DESC
     LIMIT $2`,
    [config.responsavel, limit]
  );
  return result.rows;
}

export async function getReceipt(eventId: string): Promise<Record<string, unknown> | null> {
  const activePool = getPool();
  if (!activePool) throw new Error('Postgres não configurado');

  const result = await activePool.query(
    `SELECT * FROM ${config.receiptsTable} WHERE event_id = $1 AND responsavel = $2`,
    [eventId, config.responsavel]
  );
  return result.rows[0] ?? null;
}

export async function updateReceiptClientName(
  eventId: string,
  clientName: string
): Promise<Record<string, unknown> | null> {
  const activePool = getPool();
  if (!activePool) throw new Error('Postgres não configurado');

  const result = await activePool.query(
    `UPDATE ${config.receiptsTable}
     SET client_name = $1
     WHERE event_id = $2 AND responsavel = $3
     RETURNING event_id, client_name, grand_total, issue_date`,
    [clientName, eventId, config.responsavel]
  );
  return result.rows[0] ?? null;
}

export async function deleteReceipt(eventId: string): Promise<boolean> {
  const activePool = getPool();
  if (!activePool) throw new Error('Postgres não configurado');

  const result = await activePool.query(
    `DELETE FROM ${config.receiptsTable} WHERE event_id = $1 AND responsavel = $2`,
    [eventId, config.responsavel]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function closePostgres(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}