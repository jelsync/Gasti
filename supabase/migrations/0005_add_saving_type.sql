-- ============================================================================
-- Gasti — Migración 0005: agrega el tipo de movimiento SAVING (ahorro)
--
-- IMPORTANTE: ejecuta este archivo POR SEPARADO (una sola vez) antes de 0006.
-- ALTER TYPE ... ADD VALUE no puede ejecutarse dentro de un bloque de transacción,
-- por eso va en su propia migración.
-- ============================================================================

alter type public.transaction_type add value if not exists 'SAVING';
