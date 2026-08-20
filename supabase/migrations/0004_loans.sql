-- ============================================================================
-- Gasti — Migración 0004: préstamos
-- Apartado independiente para llevar el saldo de préstamos (pasivos).
-- No afecta a las categorías/transacciones existentes.
-- ============================================================================

create table if not exists public.loans (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  category_id      uuid references public.categories (id) on delete set null,
  name             text not null,
  loan_number      text not null default '',
  original_amount  numeric(14, 2) not null,
  interest_rate    numeric(6, 3) not null default 0,
  term_months      integer not null,
  installment      numeric(14, 2) not null,
  current_balance  numeric(14, 2) not null,
  start_date       date not null default current_date,
  end_date         date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint loans_name_not_blank check (length(btrim(name)) > 0),
  constraint loans_original_positive check (original_amount > 0),
  constraint loans_rate_valid check (interest_rate >= 0 and interest_rate <= 100),
  constraint loans_term_valid check (term_months between 1 and 1200),
  constraint loans_installment_positive check (installment > 0),
  constraint loans_balance_nonnegative check (current_balance >= 0)
);

create index if not exists loans_user_id_idx on public.loans (user_id);

comment on table public.loans is 'Préstamos del usuario (saldo/pasivo); las cuotas se registran como transacciones.';

-- updated_at automático (usa la función creada en 0003)
drop trigger if exists set_loans_updated_at on public.loans;
create trigger set_loans_updated_at
  before update on public.loans
  for each row execute function public.set_updated_at();

-- RLS
alter table public.loans enable row level security;

drop policy if exists "loans_select_own" on public.loans;
create policy "loans_select_own" on public.loans
  for select using (auth.uid() = user_id);

drop policy if exists "loans_insert_own" on public.loans;
create policy "loans_insert_own" on public.loans
  for insert with check (auth.uid() = user_id);

drop policy if exists "loans_update_own" on public.loans;
create policy "loans_update_own" on public.loans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "loans_delete_own" on public.loans;
create policy "loans_delete_own" on public.loans
  for delete using (auth.uid() = user_id);
