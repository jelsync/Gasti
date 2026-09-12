-- ============================================================================
-- Gasti — Migración 0020: conciliación de cuentas y cierre mensual
-- ============================================================================

create table if not exists public.account_reconciliations (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  savings_account_id    uuid not null references public.savings_accounts (id) on delete cascade,
  reconciliation_date   date not null default current_date,
  calculated_balance    numeric(14,2) not null,
  actual_balance        numeric(14,2) not null,
  difference            numeric(14,2) generated always as
                          (actual_balance - calculated_balance) stored,
  apply_adjustment      boolean not null default true,
  notes                 text not null default '',
  created_at            timestamptz not null default now(),
  constraint account_reconciliations_notes_length check (length(notes) <= 500)
);

create index if not exists account_reconciliations_account_date_idx
  on public.account_reconciliations (savings_account_id, reconciliation_date desc);
create index if not exists account_reconciliations_user_date_idx
  on public.account_reconciliations (user_id, reconciliation_date desc);

create table if not exists public.month_closures (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  year        integer not null,
  month       smallint not null,
  snapshot    jsonb not null default '{}'::jsonb,
  notes       text not null default '',
  closed_at   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint month_closures_month_valid check (month between 1 and 12),
  constraint month_closures_year_valid check (year between 2000 and 2100),
  constraint month_closures_notes_length check (length(notes) <= 500),
  constraint month_closures_user_period_unique unique (user_id, year, month)
);

drop trigger if exists set_month_closures_updated_at on public.month_closures;
create trigger set_month_closures_updated_at
  before update on public.month_closures
  for each row execute function public.set_updated_at();

alter table public.account_reconciliations enable row level security;
alter table public.month_closures enable row level security;

drop policy if exists "account_reconciliations_select_own" on public.account_reconciliations;
create policy "account_reconciliations_select_own" on public.account_reconciliations
  for select using (auth.uid() = user_id);
drop policy if exists "account_reconciliations_insert_own" on public.account_reconciliations;
create policy "account_reconciliations_insert_own" on public.account_reconciliations
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.savings_accounts account
      where account.id = savings_account_id and account.user_id = auth.uid()
    )
  );
drop policy if exists "account_reconciliations_update_own" on public.account_reconciliations;
create policy "account_reconciliations_update_own" on public.account_reconciliations
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.savings_accounts account
      where account.id = savings_account_id and account.user_id = auth.uid()
    )
  );
drop policy if exists "account_reconciliations_delete_own" on public.account_reconciliations;
create policy "account_reconciliations_delete_own" on public.account_reconciliations
  for delete using (auth.uid() = user_id);

drop policy if exists "month_closures_select_own" on public.month_closures;
create policy "month_closures_select_own" on public.month_closures
  for select using (auth.uid() = user_id);
drop policy if exists "month_closures_insert_own" on public.month_closures;
create policy "month_closures_insert_own" on public.month_closures
  for insert with check (auth.uid() = user_id);
drop policy if exists "month_closures_update_own" on public.month_closures;
create policy "month_closures_update_own" on public.month_closures
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "month_closures_delete_own" on public.month_closures;
create policy "month_closures_delete_own" on public.month_closures
  for delete using (auth.uid() = user_id);

comment on table public.account_reconciliations is
  'Comparaciones entre saldo calculado y saldo real. Una diferencia aplicada ajusta el saldo de la cuenta sin convertirse en ingreso o gasto.';
comment on table public.month_closures is
  'Fotografía mensual informativa. No bloquea movimientos ni correcciones posteriores.';
