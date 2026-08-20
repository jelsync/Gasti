-- ============================================================================
-- Gasti — Migración 0009: tarjetas con doble moneda (Lempiras + Dólares)
--
-- Cada tarjeta lleva ahora una deuda en L y otra en $ simultáneamente.
-- Los movimientos se registran desde Transacciones:
--   - Deuda L = apertura_L + compras con tarjeta en L (gastos) − pagos en L
--   - Deuda $ = apertura_$ + compras en $ (card_charges) − pagos en $
-- ============================================================================

-- Nuevas columnas de apertura/límite en dólares.
alter table public.credit_cards
  add column if not exists opening_balance_usd numeric(14, 2) not null default 0;
alter table public.credit_cards
  add column if not exists credit_limit_usd numeric(14, 2);

-- Moneda de pagos y cargos.
alter table public.card_payments
  add column if not exists currency text not null default 'HNL';
alter table public.card_charges
  add column if not exists currency text not null default 'USD';

-- Migra datos de tarjetas que eran exclusivamente en dólares:
-- su saldo/límite pasa al lado en dólares.
update public.credit_cards
set opening_balance_usd = opening_balance,
    opening_balance = 0,
    credit_limit_usd = credit_limit,
    credit_limit = null
where currency = 'USD';

-- Ajusta la moneda de los pagos existentes según la (antigua) moneda de la tarjeta.
update public.card_payments p
set currency = c.currency
from public.credit_cards c
where p.card_id = c.id and p.currency = 'HNL' and c.currency = 'USD';

-- Constraints de moneda.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'card_payments_currency_valid') then
    alter table public.card_payments
      add constraint card_payments_currency_valid check (currency in ('HNL', 'USD'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'card_charges_currency_valid') then
    alter table public.card_charges
      add constraint card_charges_currency_valid check (currency in ('HNL', 'USD'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'credit_cards_opening_usd_nonneg') then
    alter table public.credit_cards
      add constraint credit_cards_opening_usd_nonneg check (opening_balance_usd >= 0);
  end if;
end $$;
