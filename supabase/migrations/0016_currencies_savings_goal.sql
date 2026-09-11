-- ============================================================================
-- Gasti — Migración 0016: transacciones/presupuestos por moneda y cuentas meta
-- ============================================================================

alter table public.transactions
  add column if not exists currency text not null default 'HNL';
alter table public.budgets
  add column if not exists currency text not null default 'HNL';
alter table public.savings_accounts
  add column if not exists include_in_savings_goal boolean not null default false;

alter table public.budgets
  drop constraint if exists budgets_unique_per_period;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'budgets_unique_per_period_currency'
  ) then
    alter table public.budgets
      add constraint budgets_unique_per_period_currency
      unique (user_id, category_id, year, month, currency);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_currency_valid') then
    alter table public.transactions
      add constraint transactions_currency_valid check (currency in ('HNL', 'USD'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'budgets_currency_valid') then
    alter table public.budgets
      add constraint budgets_currency_valid check (currency in ('HNL', 'USD'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'budgets_savings_currency_hnl') then
    alter table public.budgets
      add constraint budgets_savings_currency_hnl check (kind <> 'SAVINGS' or currency = 'HNL');
  end if;
end $$;

-- Cada cargo representa gasto en su propia moneda. Nunca se inventa una tasa de cambio.
update public.transactions as transaction_row
set amount = charge.amount,
    currency = charge.currency
from public.card_charges charge
where charge.transaction_id = transaction_row.id;

-- Recupera cargos USD antiguos que todavía no tenían una transacción vinculada.
insert into public.transactions (
  id,
  user_id,
  category_id,
  credit_card_id,
  type,
  amount,
  currency,
  description,
  transaction_date,
  created_at,
  updated_at
)
select
  charge.id,
  charge.user_id,
  (
    select category.id
    from public.categories category
    where category.user_id = charge.user_id
      and category.type = 'EXPENSE'
      and lower(btrim(category.name)) = lower(btrim(charge.description))
    limit 1
  ),
  charge.card_id,
  'EXPENSE',
  charge.amount,
  'USD',
  charge.description,
  charge.charge_date,
  charge.created_at,
  charge.created_at
from public.card_charges charge
where charge.currency = 'USD'
  and charge.transaction_id is null
on conflict (id) do nothing;

update public.card_charges charge
set transaction_id = charge.id
where charge.currency = 'USD'
  and charge.transaction_id is null
  and exists (
    select 1 from public.transactions transaction_row
    where transaction_row.id = charge.id
      and transaction_row.user_id = charge.user_id
  );

-- Conserva la intención de las cuentas que ya recibían movimientos Ahorro.
update public.savings_accounts account
set include_in_savings_goal = true
where exists (
  select 1
  from public.transactions transaction_row
  where transaction_row.savings_account_id = account.id
    and transaction_row.type = 'SAVING'
)
or lower(account.name) like '%elga%'
or lower(account.institution) like '%elga%';

comment on column public.transactions.currency is
  'Moneda contable del movimiento; los montos de monedas distintas nunca se suman.';
comment on column public.budgets.currency is
  'Moneda del límite mensual por categoría.';
comment on column public.savings_accounts.include_in_savings_goal is
  'Incluye el movimiento neto mensual de esta cuenta en la meta de ahorro.';
