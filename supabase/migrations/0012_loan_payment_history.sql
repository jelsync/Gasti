-- ============================================================================
-- Gasti — Migración 0012: historial estructurado de pagos de préstamos
-- ============================================================================

-- Los pagos ya se registraban como transacciones de gasto. Estas columnas
-- enlazan cada pago futuro con su préstamo y conservan su desglose financiero.
alter table public.transactions
  add column if not exists loan_id uuid references public.loans (id) on delete set null;
alter table public.transactions
  add column if not exists loan_payment_kind text;
alter table public.transactions
  add column if not exists loan_principal_amount numeric(14, 2);
alter table public.transactions
  add column if not exists loan_interest_amount numeric(14, 2);
alter table public.transactions
  add column if not exists loan_balance_after numeric(14, 2);

create index if not exists transactions_loan_idx on public.transactions (loan_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_loan_payment_kind_valid') then
    alter table public.transactions
      add constraint transactions_loan_payment_kind_valid
      check (loan_payment_kind is null or loan_payment_kind in ('INSTALLMENT', 'EXTRA'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_loan_principal_nonnegative') then
    alter table public.transactions
      add constraint transactions_loan_principal_nonnegative
      check (loan_principal_amount is null or loan_principal_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_loan_interest_nonnegative') then
    alter table public.transactions
      add constraint transactions_loan_interest_nonnegative
      check (loan_interest_amount is null or loan_interest_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_loan_balance_nonnegative') then
    alter table public.transactions
      add constraint transactions_loan_balance_nonnegative
      check (loan_balance_after is null or loan_balance_after >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_loan_payment_complete') then
    alter table public.transactions
      add constraint transactions_loan_payment_complete
      check (
        loan_payment_kind is null
        or (
          type = 'EXPENSE'
          and loan_id is not null
          and loan_principal_amount is not null
          and loan_interest_amount is not null
          and loan_balance_after is not null
        )
      );
  end if;
end $$;

comment on column public.transactions.loan_id is
  'Préstamo asociado cuando la transacción corresponde a una cuota o abono.';
comment on column public.transactions.loan_payment_kind is
  'Tipo de pago del préstamo: cuota regular (INSTALLMENT) o abono a capital (EXTRA).';
comment on column public.transactions.loan_principal_amount is
  'Parte del pago que redujo capital.';
comment on column public.transactions.loan_interest_amount is
  'Parte del pago correspondiente a intereses.';
comment on column public.transactions.loan_balance_after is
  'Saldo del préstamo después del pago.';
