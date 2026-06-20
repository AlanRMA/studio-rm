-- Corrige o primeiro recibo real: company_name nulo
-- Rode no Supabase → SQL Editor (schema prod)

-- 1) Ver os registros mais recentes e escolher o certo
SELECT event_id, client_name, company_name, issue_date, grand_total, ingested_at
FROM prod.rosania_receipts
ORDER BY ingested_at DESC
LIMIT 10;

-- 2) Atualizar o registro desejado (troque o event_id pelo valor real da consulta acima)
UPDATE prod.rosania_receipts
SET company_name = NULL
WHERE event_id = 'COLE-O-EVENT-ID-AQUI';

-- 3) Conferir
SELECT event_id, client_name, company_name
FROM prod.rosania_receipts
WHERE event_id = 'COLE-O-EVENT-ID-AQUI';