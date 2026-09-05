-- ============================================================================
-- Gasti — Migración 0015: personas que me deben (cuentas por cobrar)
-- ============================================================================

create table if not exists public.receivable_people (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  relationship  text not null default 'OTHER',
  phone         text not null default '',
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint receivable_people_name_not_blank check (length(btrim(name)) > 0),
  constraint receivable_people_relationship_valid
    check (relationship in ('FAMILY', 'FRIEND', 'OTHER'))
);

create index if not exists receivable_people_user_idx
  on public.receivable_people (user_id, created_at);

alter table public.transactions
  add column if not exists receivable_person_id uuid
  references public.receivable_people (id) on delete restrict;
alter table public.transactions
  add column if not exists receivable_movement_kind text;

create index if not exists transactions_receivable_person_idx
  on public.transactions (receivable_person_id, transaction_date);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_receivable_movement_valid'
  ) then
    alter table public.transactions
      add constraint transactions_receivable_movement_valid check (
        receivable_movement_kind is null
        or (
          type = 'TRANSFER'
          and receivable_person_id is not null
          and (
            (
              receivable_movement_kind = 'LEND'
              and destination_savings_account_id is null
            )
            or (
              receivable_movement_kind = 'REPAYMENT'
              and savings_account_id is null
            )
          )
        )
      );
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_receivable_link_complete'
  ) then
    alter table public.transactions
      add constraint transactions_receivable_link_complete check (
        (receivable_person_id is null and receivable_movement_kind is null)
        or (receivable_person_id is not null and receivable_movement_kind is not null)
      );
  end if;
end $$;

-- Amplía la regla creada en 0014 para aceptar préstamos entregados y pagos recibidos.
alter table public.transactions
  drop constraint if exists transactions_transfer_accounts_valid;
alter table public.transactions
  add constraint transactions_transfer_accounts_valid check (
    type <> 'TRANSFER'
    or credit_card_id is not null
    or receivable_movement_kind is not null
    or savings_account_id is not null
    or destination_savings_account_id is not null
  );

drop trigger if exists set_receivable_people_updated_at on public.receivable_people;
create trigger set_receivable_people_updated_at
  before update on public.receivable_people
  for each row execute function public.set_updated_at();

alter table public.receivable_people enable row level security;

drop policy if exists "receivable_people_select_own" on public.receivable_people;
create policy "receivable_people_select_own" on public.receivable_people
  for select using (auth.uid() = user_id);
drop policy if exists "receivable_people_insert_own" on public.receivable_people;
create policy "receivable_people_insert_own" on public.receivable_people
  for insert with check (auth.uid() = user_id);
drop policy if exists "receivable_people_update_own" on public.receivable_people;
create policy "receivable_people_update_own" on public.receivable_people
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "receivable_people_delete_own" on public.receivable_people;
create policy "receivable_people_delete_own" on public.receivable_people
  for delete using (auth.uid() = user_id);

comment on table public.receivable_people is
  'Personas con dinero pendiente de devolución al usuario.';
comment on column public.transactions.receivable_movement_kind is
  'LEND entrega dinero y aumenta la cuenta por cobrar; REPAYMENT registra una devolución.';
