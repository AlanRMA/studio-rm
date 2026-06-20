import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import type { IngestReceiptPayload } from '../schemas/receipt.js';

export interface QueuedReceipt {
  id: number;
  event_id: string;
  payload_json: string;
  created_at: string;
  attempts: number;
  last_error: string | null;
}

interface QueueStore {
  nextId: number;
  pending: Array<{
    id: number;
    event_id: string;
    payload_json: string;
    created_at: string;
    attempts: number;
    last_error: string | null;
  }>;
  recent_events: Array<{
    event_id: string;
    receipt_id: string;
    content_hash: string;
    event_at: string;
  }>;
}

const EMPTY_STORE: QueueStore = {
  nextId: 1,
  pending: [],
  recent_events: [],
};

export class ReceiptQueue {
  private storePath: string;
  private store: QueueStore;

  constructor() {
    this.storePath = path.resolve(config.sqlitePath.replace(/\.db$/, '.json'));
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    this.store = this.load();
  }

  private load(): QueueStore {
    if (!fs.existsSync(this.storePath)) {
      return structuredClone(EMPTY_STORE);
    }

    try {
      const raw = fs.readFileSync(this.storePath, 'utf8');
      return { ...structuredClone(EMPTY_STORE), ...JSON.parse(raw) };
    } catch {
      return structuredClone(EMPTY_STORE);
    }
  }

  private persist(): void {
    fs.writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), 'utf8');
  }

  enqueue(payload: IngestReceiptPayload): void {
    if (this.store.pending.some((item) => item.event_id === payload.event_id)) {
      return;
    }

    const item = {
      id: this.store.nextId++,
      event_id: payload.event_id,
      payload_json: JSON.stringify(payload),
      created_at: new Date().toISOString(),
      attempts: 0,
      last_error: null,
    };

    this.store.pending.push(item);
    this.persist();
  }

  listPending(limit = 50): QueuedReceipt[] {
    return this.store.pending
      .slice()
      .sort((a, b) => a.id - b.id)
      .slice(0, limit);
  }

  remove(eventId: string): void {
    this.store.pending = this.store.pending.filter((item) => item.event_id !== eventId);
    this.persist();
  }

  markAttempt(eventId: string, error: string): void {
    const item = this.store.pending.find((entry) => entry.event_id === eventId);
    if (!item) return;

    item.attempts += 1;
    item.last_error = error;
    this.persist();
  }

  hasEvent(eventId: string): boolean {
    return this.store.recent_events.some((event) => event.event_id === eventId);
  }

  recordEvent(eventId: string, receiptId: string, contentHash: string, eventAt: string): void {
    if (!this.hasEvent(eventId)) {
      this.store.recent_events.push({
        event_id: eventId,
        receipt_id: receiptId,
        content_hash: contentHash,
        event_at: eventAt,
      });
    }

    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    this.store.recent_events = this.store.recent_events.filter(
      (event) => new Date(event.event_at).getTime() >= cutoff
    );
    this.persist();
  }

  findRapidDuplicate(
    contentHash: string,
    eventAtIso: string,
    windowMs: number
  ): { event_id: string; event_at: string } | null {
    const cutoff = new Date(eventAtIso).getTime() - windowMs;

    const match = this.store.recent_events
      .filter(
        (event) =>
          event.content_hash === contentHash &&
          new Date(event.event_at).getTime() >= cutoff
      )
      .sort((a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime())[0];

    return match ?? null;
  }

  pendingCount(): number {
    return this.store.pending.length;
  }

  close(): void {
    this.persist();
  }
}