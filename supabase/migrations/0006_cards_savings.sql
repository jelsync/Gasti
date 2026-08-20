-- ============================================================================
-- Gasti — Migración 0006: tarjetas de crédito y cuentas de ahorro
-- ============================================================================

-- ----------------------------------------------------------------------------
-- credit_cards
-- ----------------------------------------------------------------------------
create table if not exists public.credit_cards (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null,
  bank             text not null default '',
  opening_balance  numeric(14, 2) not null default 0,
  credit_limit     numeric(14, 2),
  color            text not null default '#6366f1',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint credit_cards_name_not_blank check (length(btrim(name)) > 0),
  constraint credit_cards_opening_nonneg check (opening_balance >= 0),
  constraint credit_cards_limit_positive check (credit_limit is null or credit_limit > 0)
);

create index if not exists credit_cards_user_id_idx on public.credit_cards (user_id);
comment on table public.credit_cards is 'Tarjetas de crédito. La deuda se calcula: apertura + compras − pagos.';

-- Pagos a la tarjeta (reducen la deuda; NO son gastos).
create table if not exists public.card_payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  card_id       uuid not null references public.credit_cards (id) on delete cascade,
  amount        numeric(14, 2) not null,
  payment_date  date not null default current_date,
  created_at    timestamptz not null default now(),
  constraint card_payments_amount_positive check (amount > 0)
);

create index if not exists card_payments_card_idx on public.card_payments (card_id);
comment on table public.card_payments is 'Pagos a tarjetas de crédito (reducen la deuda, no cuentan como gasto).';

-- ----------------------------------------------------------------------------
-- savings_accounts
-- ----------------------------------------------------------------------------
create table if not exists public.savings_accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null,
  institution      text not null default '',
  opening_balance  numeric(14, 2) not null default 0,
  color            text not null default '#0ea5e9',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint savings_name_not_blank check (length(btrim(name)) > 0)
);

create index if not exists savings_accounts_user_id_idx on public.savings_accounts (user_id);
comment on table public.savings_accounts is 'Cuentas de ahorro. Saldo = apertura + aportes (movimientos SAVING).';

-- ----------------------------------------------------------------------------
-- transactions: enlaces opcionales a tarjeta y a cuenta de ahorro
-- ----------------------------------------------------------------------------
alter table public.transactions
  add column if not exists credit_card_id uuid references public.credit_cards (id) on delete set null;
alter table public.transactions
  add column if not exists savings_account_id uuid references public.savings_accounts (id) on delete set null;

create index if not exists transactions_card_idx on public.transactions (credit_card_id);
create index if not exists transactions_savings_idx on public.transactions (savings_account_id);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
drop trigger if exists set_credit_cards_updated_at on public.credit_cards;
create trigger set_credit_cards_updated_at
  before update on public.credit_cards
  for each row execute function public.set_updated_at();

drop trigger if exists set_savings_accounts_updated_at on public.savings_accounts;
create trigger set_savings_accounts_updated_at
  before update on public.savings_accounts
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.credit_cards     enable row level security;
alter table public.card_payments    enable row level security;
alter table public.savings_accounts enable row level security;

-- credit_cards
drop policy if exists "credit_cards_select_own" on public.credit_cards;
create policy "credit_cards_select_own" on public.credit_cards
  for select using (auth.uid() = user_id);
drop policy if exists "credit_cards_insert_own" on public.credit_cards;
create policy "credit_cards_insert_own" on public.credit_cards
  for insert with check (auth.uid() = user_id);
drop policy if exists "credit_cards_update_own" on public.credit_cards;
create policy "credit_cards_update_own" on public.credit_cards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "credit_cards_delete_own" on public.credit_cards;
create policy "credit_cards_delete_own" on public.credit_cards
  for delete using (auth.uid() = user_id);

-- card_payments
drop policy if exists "card_payments_select_own" on public.card_payments;
create policy "card_payments_select_own" on public.card_payments
  for select using (auth.uid() = user_id);
drop policy if exists "card_payments_insert_own" on public.card_payments;
create policy "card_payments_insert_own" on public.card_payments
  for insert with check (auth.uid() = user_id);
drop policy if exists "card_payments_delete_own" on public.card_payments;
create policy "card_payments_delete_own" on public.card_payments
  for delete using (auth.uid() = user_id);

-- savings_accounts
drop policy if exists "savings_accounts_select_own" on public.savings_accounts;
create policy "savings_accounts_select_own" on public.savings_accounts
  for select using (auth.uid() = user_id);
drop policy if exists "savings_accounts_insert_own" on public.savings_accounts;
create policy "savings_accounts_insert_own" on public.savings_accounts
  for insert with check (auth.uid() = user_id);
drop policy if exists "savings_accounts_update_own" on public.savings_accounts;
create policy "savings_accounts_update_own" on public.savings_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "savings_accounts_delete_own" on public.savings_accounts;
create policy "savings_accounts_delete_own" on public.savings_accounts
  for delete using (auth.uid() = user_id);
