import { config } from '../config.js';
import {
  checkPostgresConnection,
  findExistingEvent,
  findRapidDuplicate as findPgRapidDuplicate,
  insertReceipt,
  isPostgresConfigured,
} from '../db/postgres.js';
import type { ReceiptQueue } from '../db/queue.js';
import type { IngestReceiptPayload } from '../schemas/receipt.js';
import { buildContentHash } from './hash.js';

export type IngestResult =
  | { status: 'created'; queued: boolean }
  | { status: 'duplicate'; message: string }
  | { status: 'idempotent' };

export async function ingestReceipt(
  payload: IngestReceiptPayload,
  queue: ReceiptQueue
): Promise<IngestResult> {
  const contentHash = buildContentHash(payload);

  if (queue.hasEvent(payload.event_id)) {
    return { status: 'idempotent' };
  }

  const localDuplicate = queue.findRapidDuplicate(
    contentHash,
    payload.event_at,
    config.duplicateWindowMs
  );
  if (localDuplicate && localDuplicate.event_id !== payload.event_id) {
    return {
      status: 'duplicate',
      message: `Recibo idêntico enviado há poucos segundos (event_id: ${localDuplicate.event_id}).`,
    };
  }

  const postgresUp = isPostgresConfigured() && (await checkPostgresConnection());

  if (postgresUp) {
    const exists = await findExistingEvent(payload.event_id);
    if (exists) {
      queue.recordEvent(
        payload.event_id,
        payload.receipt.id,
        contentHash,
        payload.event_at
      );
      return { status: 'idempotent' };
    }

    const pgDuplicate = await findPgRapidDuplicate(
      contentHash,
      payload.event_at,
      config.duplicateWindowMs
    );
    if (pgDuplicate && pgDuplicate.event_id !== payload.event_id) {
      return {
        status: 'duplicate',
        message: `Recibo idêntico já registrado (event_id: ${pgDuplicate.event_id}).`,
      };
    }

    try {
      await insertReceipt(payload);
      queue.recordEvent(
        payload.event_id,
        payload.receipt.id,
        contentHash,
        payload.event_at
      );
      queue.remove(payload.event_id);
      return { status: 'created', queued: false };
    } catch (error) {
      console.error('[ingest] Falha no Postgres, enfileirando:', error);
      queue.enqueue(payload);
      queue.recordEvent(
        payload.event_id,
        payload.receipt.id,
        contentHash,
        payload.event_at
      );
      return { status: 'created', queued: true };
    }
  }

  queue.enqueue(payload);
  queue.recordEvent(
    payload.event_id,
    payload.receipt.id,
    contentHash,
    payload.event_at
  );
  return { status: 'created', queued: true };
}

export async function flushQueue(queue: ReceiptQueue): Promise<number> {
  if (!isPostgresConfigured()) return 0;

  const postgresUp = await checkPostgresConnection();
  if (!postgresUp) return 0;

  const pending = queue.listPending();
  let flushed = 0;

  for (const item of pending) {
    try {
      const payload = JSON.parse(item.payload_json) as IngestReceiptPayload;
      const exists = await findExistingEvent(payload.event_id);
      if (!exists) {
        await insertReceipt(payload);
      }
      queue.remove(payload.event_id);
      flushed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      queue.markAttempt(item.event_id, message);
      console.error(`[flush] Falha no event_id ${item.event_id}:`, message);
      break;
    }
  }

  if (flushed > 0) {
    console.log(`[flush] ${flushed} recibo(s) ingerido(s) no Postgres`);
  }

  return flushed;
}