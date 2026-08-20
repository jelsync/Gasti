-- ============================================================================
-- Gasti — Migración 0008: compras/cargos de tarjetas en dólares
--
-- Para tarjetas en USD, las compras NO se registran como transacciones en
-- lempiras (el gasto en L se reconoce al pagar). Estos cargos solo aumentan
-- la deuda de la tarjeta en su moneda.
-- ============================================================================

create table if not exists public.card_charges (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  card_id      uuid not null references public.credit_cards (id) on delete cascade,
  amount       numeric(14, 2) not null,
  description  text not null default '',
  charge_date  date not null default current_date,
  created_at   timestamptz not null default now(),
  constraint card_charges_amount_positive check (amount > 0)
);

create index if not exists card_charges_card_idx on public.card_charges (card_id);
comment on table public.card_charges is 'Compras/cargos a tarjetas (aumentan la deuda en la moneda de la tarjeta).';

alter table public.card_charges enable row level security;

drop policy if exists "card_charges_select_own" on public.card_charges;
create policy "card_charges_select_own" on public.card_charges
  for select using (auth.uid() = user_id);

drop policy if exists "card_charges_insert_own" on public.card_charges;
create policy "card_charges_insert_own" on public.card_charges
  for insert with check (auth.uid() = user_id);

drop policy if exists "card_charges_delete_own" on public.card_charges;
create policy "card_charges_delete_own" on public.card_charges
  for delete using (auth.uid() = user_id);
