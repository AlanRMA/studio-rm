-- Execute no Supabase: SQL Editor → New query → Run
-- Tabela principal de recibos da Rosania

CREATE TABLE IF NOT EXISTS rosania_receipts (
  event_id              TEXT PRIMARY KEY,
  responsavel           TEXT NOT NULL DEFAULT 'Rosania',
  receipt_id            TEXT NOT NULL,
  invoice_number        TEXT NOT NULL,
  client_name           TEXT NOT NULL,
  service_type          TEXT,
  issue_date            DATE NOT NULL,
  company_name          TEXT,
  show_emitter          BOOLEAN NOT NULL DEFAULT FALSE,
  emitter_document_type TEXT,
  emitter_legal_name    TEXT,
  emitter_document      TEXT,
  delivery_fee          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  adjustment            NUMERIC(12, 2) NOT NULL DEFAULT 0,
  adjustment_kind       TEXT CHECK (adjustment_kind IN ('increase', 'discount')),
  subtotal              NUMERIC(12, 2) NOT NULL,
  grand_total           NUMERIC(12, 2) NOT NULL,
  item_count            INT NOT NULL,
  export_format         TEXT CHECK (export_format IN ('jpeg', 'pdf')),
  lines                 JSONB NOT NULL,
  content_hash          TEXT NOT NULL,
  event_at              TIMESTAMPTZ NOT NULL,
  ingested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rosania_receipts_responsavel
  ON rosania_receipts (responsavel);

CREATE INDEX IF NOT EXISTS idx_rosania_receipts_issue_date
  ON rosania_receipts (issue_date DESC);

CREATE INDEX IF NOT EXISTS idx_rosania_receipts_client
  ON rosania_receipts (client_name);

CREATE INDEX IF NOT EXISTS idx_rosania_receipts_receipt_id
  ON rosania_receipts (receipt_id);

CREATE INDEX IF NOT EXISTS idx_rosania_receipts_content_hash
  ON rosania_receipts (responsavel, content_hash, event_at DESC);