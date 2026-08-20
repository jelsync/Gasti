-- ============================================================================
-- Gasti — Migración 0007: moneda de las tarjetas de crédito (HNL / USD)
-- ============================================================================

-- Moneda de la tarjeta (por defecto Lempiras).
alter table public.credit_cards
  add column if not exists currency text not null default 'HNL';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'credit_cards_currency_valid'
  ) then
    alter table public.credit_cards
      add constraint credit_cards_currency_valid check (currency in ('HNL', 'USD'));
  end if;
end $$;

-- Monto pagado en lempiras (para pagos de tarjetas en dólares).
alter table public.card_payments
  add column if not exists amount_hnl numeric(14, 2);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'card_payments_amount_hnl_positive'
  ) then
    alter table public.card_payments
      add constraint card_payments_amount_hnl_positive
      check (amount_hnl is null or amount_hnl > 0);
  end if;
end $$;
