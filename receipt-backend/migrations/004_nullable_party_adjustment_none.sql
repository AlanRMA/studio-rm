-- Permite client_name nulo e adjustment_kind = 'none' (valor integral)
-- Rode no Supabase SQL Editor (schemas dev e prod)

ALTER TABLE dev.rosania_receipts
  ALTER COLUMN client_name DROP NOT NULL;

ALTER TABLE prod.rosania_receipts
  ALTER COLUMN client_name DROP NOT NULL;

ALTER TABLE dev.rosania_receipts
  DROP CONSTRAINT IF EXISTS rosania_receipts_adjustment_kind_check;

ALTER TABLE prod.rosania_receipts
  DROP CONSTRAINT IF EXISTS rosania_receipts_adjustment_kind_check;

ALTER TABLE dev.rosania_receipts
  ADD CONSTRAINT rosania_receipts_adjustment_kind_check
  CHECK (adjustment_kind IN ('increase', 'discount', 'none'));

ALTER TABLE prod.rosania_receipts
  ADD CONSTRAINT rosania_receipts_adjustment_kind_check
  CHECK (adjustment_kind IN ('increase', 'discount', 'none'));

UPDATE dev.rosania_receipts
SET adjustment_kind = 'none'
WHERE adjustment = 0;

UPDATE prod.rosania_receipts
SET adjustment_kind = 'none'
WHERE adjustment = 0;