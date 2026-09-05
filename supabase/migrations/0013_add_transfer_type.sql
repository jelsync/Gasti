-- ============================================================================
-- Gasti — Migración 0013: tipo de movimiento TRANSFER
--
-- IMPORTANTE: ejecutar esta migración por separado antes de 0014.
-- ============================================================================

alter type public.transaction_type add value if not exists 'TRANSFER';
