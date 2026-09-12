-- ============================================================================
-- Gasti — Migración 0018: transacciones recurrentes confirmables
-- ============================================================================

create table if not exists public.recurring_transactions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  name               text not null,
  type               public.transaction_type not null,
  amount             numeric(14,2) not null,
  currency           text not null default 'HNL',
  category_id        uuid references public.categories (id) on delete set null,
  savings_account_id uuid references public.savings_accounts (id) on delete set null,
  credit_card_id     uuid references public.credit_cards (id) on delete set null,
  description        text not null default '',
  day_of_month       smallint not null,
  start_date         date not null default current_date,
  end_date           date,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint recurring_name_not_blank check (length(btrim(name)) > 0),
  constraint recurring_type_valid check (type in ('INCOME', 'EXPENSE')),
  constraint recurring_amount_positive check (amount > 0),
  constraint recurring_currency_valid check (currency in ('HNL', 'USD')),
  constraint recurring_day_valid check (day_of_month between 1 and 31),
  constraint recurring_dates_valid check (end_date is null or end_date >= start_date),
  constraint recurring_account_currency_hnl check (
    savings_account_id is null or currency = 'HNL'
  ),
  constraint recurring_destination_valid check (
    (
      type = 'INCOME'
      and credit_card_id is null
    )
    or (
      type = 'EXPENSE'
      and num_nonnulls(savings_account_id, credit_card_id) <= 1
    )
  )
);

create index if not exists recurring_transactions_user_active_idx
  on public.recurring_transactions (user_id, is_active, day_of_month);

create table if not exists public.recurring_occurrences (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users (id) on delete cascade,
  recurring_transaction_id uuid not null references public.recurring_transactions (id) on delete cascade,
  due_date                 date not null,
  period_start             date generated always as (
    due_date - (extract(day from due_date)::integer - 1)
  ) stored,
  status                   text not null,
  transaction_id           uuid references public.transactions (id) on delete cascade,
  created_at               timestamptz not null default now(),
  constraint recurring_occurrence_status_valid check (status in ('COMPLETED', 'SKIPPED')),
  constraint recurring_occurrence_transaction_valid check (
    (status = 'COMPLETED' and transaction_id is not null)
    or (status = 'SKIPPED' and transaction_id is null)
  ),
  constraint recurring_occurrence_unique unique (recurring_transaction_id, period_start)
);

create index if not exists recurring_occurrences_user_date_idx
  on public.recurring_occurrences (user_id, due_date desc);

drop trigger if exists set_recurring_transactions_updated_at on public.recurring_transactions;
create trigger set_recurring_transactions_updated_at
  before update on public.recurring_transactions
  for each row execute function public.set_updated_at();

alter table public.recurring_transactions enable row level security;
alter table public.recurring_occurrences enable row level security;

drop policy if exists "recurring_transactions_select_own" on public.recurring_transactions;
create policy "recurring_transactions_select_own" on public.recurring_transactions
  for select using (auth.uid() = user_id);
drop policy if exists "recurring_transactions_insert_own" on public.recurring_transactions;
create policy "recurring_transactions_insert_own" on public.recurring_transactions
  for insert with check (
    auth.uid() = user_id
    and (
      category_id is null
      or exists (
        select 1 from public.categories category
        where category.id = category_id
          and category.user_id = auth.uid()
          and category.type = recurring_transactions.type
      )
    )
    and (
      savings_account_id is null
      or exists (
        select 1 from public.savings_accounts account
        where account.id = savings_account_id and account.user_id = auth.uid()
      )
    )
    and (
      credit_card_id is null
      or exists (
        select 1 from public.credit_cards card
        where card.id = credit_card_id and card.user_id = auth.uid()
      )
    )
  );
drop policy if exists "recurring_transactions_update_own" on public.recurring_transactions;
create policy "recurring_transactions_update_own" on public.recurring_transactions
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and (
      category_id is null
      or exists (
        select 1 from public.categories category
        where category.id = category_id
          and category.user_id = auth.uid()
          and category.type = recurring_transactions.type
      )
    )
    and (
      savings_account_id is null
      or exists (
        select 1 from public.savings_accounts account
        where account.id = savings_account_id and account.user_id = auth.uid()
      )
    )
    and (
      credit_card_id is null
      or exists (
        select 1 from public.credit_cards card
        where card.id = credit_card_id and card.user_id = auth.uid()
      )
    )
  );
drop policy if exists "recurring_transactions_delete_own" on public.recurring_transactions;
create policy "recurring_transactions_delete_own" on public.recurring_transactions
  for delete using (auth.uid() = user_id);

drop policy if exists "recurring_occurrences_select_own" on public.recurring_occurrences;
create policy "recurring_occurrences_select_own" on public.recurring_occurrences
  for select using (auth.uid() = user_id);
drop policy if exists "recurring_occurrences_insert_own" on public.recurring_occurrences;
create policy "recurring_occurrences_insert_own" on public.recurring_occurrences
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.recurring_transactions recurring
      where recurring.id = recurring_transaction_id
        and recurring.user_id = auth.uid()
    )
    and (
      transaction_id is null
      or exists (
        select 1 from public.transactions transaction_row
        where transaction_row.id = transaction_id
          and transaction_row.user_id = auth.uid()
      )
    )
  );
drop policy if exists "recurring_occurrences_delete_own" on public.recurring_occurrences;
create policy "recurring_occurrences_delete_own" on public.recurring_occurrences
  for delete using (auth.uid() = user_id);

create or replace function public.confirm_recurring_transaction(
  p_recurring_id uuid,
  p_due_date date
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  recurring_row public.recurring_transactions%rowtype;
  expected_due_date date;
  transaction_id uuid;
begin
  select * into recurring_row
  from public.recurring_transactions
  where id = p_recurring_id
    and user_id = auth.uid()
    and is_active
  for update;

  if not found then
    raise exception 'La transacción recurrente no existe o está pausada.';
  end if;

  expected_due_date := make_date(
    extract(year from p_due_date)::integer,
    extract(month from p_due_date)::integer,
    least(
      recurring_row.day_of_month,
      extract(day from (date_trunc('month', p_due_date) + interval '1 month - 1 day'))::integer
    )
  );

  if p_due_date <> expected_due_date
    or p_due_date < recurring_row.start_date
    or (recurring_row.end_date is not null and p_due_date > recurring_row.end_date) then
    raise exception 'La fecha indicada no corresponde a un movimiento pendiente.';
  end if;

  if exists (
    select 1 from public.recurring_occurrences occurrence
    where occurrence.recurring_transaction_id = recurring_row.id
      and occurrence.period_start = date_trunc('month', p_due_date)::date
  ) then
    raise exception 'Este movimiento recurrente ya fue atendido.';
  end if;

  if recurring_row.category_id is null or not exists (
    select 1 from public.categories category
    where category.id = recurring_row.category_id
      and category.user_id = recurring_row.user_id
      and category.type = recurring_row.type
  ) then
    raise exception 'Selecciona una categoría válida antes de confirmar este movimiento.';
  end if;

  if recurring_row.type = 'EXPENSE'
    and recurring_row.savings_account_id is null
    and recurring_row.credit_card_id is null then
    raise exception 'Selecciona una cuenta o tarjeta antes de confirmar este gasto.';
  end if;

  insert into public.transactions (
    user_id,
    type,
    amount,
    currency,
    category_id,
    credit_card_id,
    savings_account_id,
    description,
    transaction_date
  ) values (
    recurring_row.user_id,
    recurring_row.type,
    recurring_row.amount,
    recurring_row.currency,
    recurring_row.category_id,
    recurring_row.credit_card_id,
    recurring_row.savings_account_id,
    recurring_row.description,
    p_due_date
  ) returning id into transaction_id;

  if recurring_row.credit_card_id is not null then
    insert into public.card_charges (
      user_id,
      card_id,
      amount,
      amount_hnl,
      currency,
      description,
      charge_date,
      transaction_id
    ) values (
      recurring_row.user_id,
      recurring_row.credit_card_id,
      recurring_row.amount,
      null,
      recurring_row.currency,
      recurring_row.description,
      p_due_date,
      transaction_id
    );
  end if;

  insert into public.recurring_occurrences (
    user_id,
    recurring_transaction_id,
    due_date,
    status,
    transaction_id
  ) values (
    recurring_row.user_id,
    recurring_row.id,
    p_due_date,
    'COMPLETED',
    transaction_id
  );

  return transaction_id;
end;
$$;

create or replace function public.skip_recurring_occurrence(
  p_recurring_id uuid,
  p_due_date date
)
returns void
language plpgsql
set search_path = public
as $$
declare
  recurring_row public.recurring_transactions%rowtype;
  expected_due_date date;
begin
  select * into recurring_row
  from public.recurring_transactions
  where id = p_recurring_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'La transacción recurrente no existe.';
  end if;

  expected_due_date := make_date(
    extract(year from p_due_date)::integer,
    extract(month from p_due_date)::integer,
    least(
      recurring_row.day_of_month,
      extract(day from (date_trunc('month', p_due_date) + interval '1 month - 1 day'))::integer
    )
  );

  if p_due_date <> expected_due_date
    or p_due_date < recurring_row.start_date
    or (recurring_row.end_date is not null and p_due_date > recurring_row.end_date) then
    raise exception 'La fecha indicada no corresponde a un movimiento pendiente.';
  end if;

  insert into public.recurring_occurrences (
    user_id,
    recurring_transaction_id,
    due_date,
    status,
    transaction_id
  ) values (
    recurring_row.user_id,
    recurring_row.id,
    p_due_date,
    'SKIPPED',
    null
  );
end;
$$;

comment on table public.recurring_transactions is
  'Reglas mensuales que el usuario confirma antes de crear movimientos reales.';
comment on table public.recurring_occurrences is
  'Fechas recurrentes completadas u omitidas para impedir duplicados.';
