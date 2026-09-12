-- ============================================================================
-- Gasti — Migración 0019: fechas para calendario financiero
-- ============================================================================

alter table public.loans
  add column if not exists payment_day smallint;

alter table public.credit_cards
  add column if not exists payment_due_day smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'loans_payment_day_valid'
  ) then
    alter table public.loans
      add constraint loans_payment_day_valid
      check (payment_day is null or payment_day between 1 and 31);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'credit_cards_payment_due_day_valid'
  ) then
    alter table public.credit_cards
      add constraint credit_cards_payment_due_day_valid
      check (payment_due_day is null or payment_due_day between 1 and 31);
  end if;
end $$;

-- Una estimación útil para préstamos existentes; el usuario puede corregirla al editar.
update public.loans
set payment_day = extract(day from start_date)::smallint
where payment_day is null;

comment on column public.loans.payment_day is
  'Día mensual de pago usado por el calendario financiero.';
comment on column public.credit_cards.payment_due_day is
  'Día límite mensual de pago usado por el calendario financiero.';
