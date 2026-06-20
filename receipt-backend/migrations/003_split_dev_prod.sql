-- Migra dados legados (tabela public.rosania_receipts) para prod, se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rosania_receipts'
  ) THEN
    INSERT INTO prod.rosania_receipts
    SELECT * FROM public.rosania_receipts
    ON CONFLICT (event_id) DO NOTHING;

    DROP TABLE public.rosania_receipts CASCADE;
  END IF;
END $$;

-- Remove views legadas que apontavam para public
DROP VIEW IF EXISTS v_rosania_receipts_base;
DROP VIEW IF EXISTS v_rosania_top_clients_by_count;
DROP VIEW IF EXISTS v_rosania_top_clients_by_revenue;