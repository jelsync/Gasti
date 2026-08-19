-- ============================================================================
-- Gasti — Migración 0001: esquema base
-- Tablas: profiles, categories, transactions, budgets
-- Ejecutar en el SQL Editor de Supabase (o vía Supabase CLI) EN ORDEN.
-- ============================================================================

-- Extensión para gen_random_uuid()
create extension if not exists pgcrypto;

-- Tipo de transacción / categoría
do $$
begin
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type public.transaction_type as enum ('INCOME', 'EXPENSE');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- profiles: 1:1 con auth.users
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  email       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Perfil público del usuario (1:1 con auth.users).';

-- ----------------------------------------------------------------------------
-- categories: categorías por usuario (predeterminadas + personalizadas)
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  type        public.transaction_type not null,
  icon        text not null default 'circle',
  color       text not null default '#64748b',
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint categories_name_not_blank check (length(btrim(name)) > 0),
  constraint categories_unique_per_user unique (user_id, type, name)
);

create index if not exists categories_user_id_idx on public.categories (user_id);
create index if not exists categories_user_type_idx on public.categories (user_id, type);

comment on table public.categories is 'Categorías de ingresos/gastos propias de cada usuario.';

-- ----------------------------------------------------------------------------
-- transactions: movimientos de ingreso/gasto
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  category_id       uuid references public.categories (id) on delete set null,
  type              public.transaction_type not null,
  amount            numeric(14, 2) not null,
  description       text not null default '',
  transaction_date  date not null default current_date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint transactions_amount_positive check (amount > 0)
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc);
create index if not exists transactions_user_category_idx
  on public.transactions (user_id, category_id);
create index if not exists transactions_user_type_date_idx
  on public.transactions (user_id, type, transaction_date desc);

comment on table public.transactions is 'Ingresos y gastos registrados por el usuario.';

-- ----------------------------------------------------------------------------
-- budgets: presupuesto mensual por categoría
-- ----------------------------------------------------------------------------
create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount      numeric(14, 2) not null,
  month       smallint not null,
  year        smallint not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint budgets_amount_positive check (amount > 0),
  constraint budgets_month_valid check (month between 1 and 12),
  constraint budgets_year_valid check (year between 2000 and 2100),
  constraint budgets_unique_per_period unique (user_id, category_id, year, month)
);

create index if not exists budgets_user_period_idx on public.budgets (user_id, year, month);

comment on table public.budgets is 'Presupuesto mensual por categoría y usuario.';
