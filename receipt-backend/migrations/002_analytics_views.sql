-- Views analíticas para dashboard da Rosania

CREATE OR REPLACE VIEW v_rosania_receipts_base AS
SELECT
  event_id,
  responsavel,
  receipt_id,
  client_name,
  service_type,
  issue_date,
  grand_total,
  item_count,
  export_format,
  event_at,
  ingested_at
FROM rosania_receipts
WHERE responsavel = 'Rosania';

CREATE OR REPLACE VIEW v_rosania_top_clients_by_count AS
SELECT
  client_name,
  COUNT(*)::INT AS receipt_count,
  SUM(grand_total)::NUMERIC(12, 2) AS total_revenue,
  AVG(grand_total)::NUMERIC(12, 2) AS avg_ticket
FROM rosania_receipts
WHERE responsavel = 'Rosania'
GROUP BY client_name;

CREATE OR REPLACE VIEW v_rosania_top_clients_by_revenue AS
SELECT
  client_name,
  COUNT(*)::INT AS receipt_count,
  SUM(grand_total)::NUMERIC(12, 2) AS total_revenue,
  AVG(grand_total)::NUMERIC(12, 2) AS avg_ticket
FROM rosania_receipts
WHERE responsavel = 'Rosania'
GROUP BY client_name;