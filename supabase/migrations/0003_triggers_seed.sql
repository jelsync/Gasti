-- ============================================================================
-- Gasti — Migración 0003: triggers y seed de categorías por usuario
-- ============================================================================

-- ----------------------------------------------------------------------------
-- updated_at automático
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

drop trigger if exists set_budgets_updated_at on public.budgets;
create trigger set_budgets_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Seed de categorías predeterminadas para un usuario dado
-- ----------------------------------------------------------------------------
create or replace function public.seed_default_categories(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, type, icon, color, is_default)
  values
    -- Gastos
    (uid, 'Alimentación',   'EXPENSE', 'utensils',       '#ef4444', true),
    (uid, 'Supermercado',   'EXPENSE', 'shopping-cart',  '#f97316', true),
    (uid, 'Transporte',     'EXPENSE', 'bus',            '#f59e0b', true),
    (uid, 'Combustible',    'EXPENSE', 'fuel',           '#eab308', true),
    (uid, 'Casa',           'EXPENSE', 'house',          '#84cc16', true),
    (uid, 'Servicios',      'EXPENSE', 'plug-zap',       '#10b981', true),
    (uid, 'Entretenimiento','EXPENSE', 'clapperboard',   '#06b6d4', true),
    (uid, 'Salud',          'EXPENSE', 'heart-pulse',    '#ec4899', true),
    (uid, 'Educación',      'EXPENSE', 'graduation-cap', '#8b5cf6', true),
    (uid, 'Compras',        'EXPENSE', 'shopping-bag',   '#6366f1', true),
    (uid, 'Suscripciones',  'EXPENSE', 'credit-card',    '#0ea5e9', true),
    (uid, 'Deudas',         'EXPENSE', 'landmark',       '#64748b', true),
    (uid, 'Otros',          'EXPENSE', 'ellipsis',       '#94a3b8', true),
    -- Ingresos
    (uid, 'Salario',        'INCOME',  'wallet',         '#059669', true),
    (uid, 'Freelance',      'INCOME',  'laptop',         '#0d9488', true),
    (uid, 'Negocio',        'INCOME',  'store',          '#2563eb', true),
    (uid, 'Bonos',          'INCOME',  'gift',           '#7c3aed', true),
    (uid, 'Otros ingresos', 'INCOME',  'circle-plus',    '#16a34a', true)
  on conflict (user_id, type, name) do nothing;
end;
$$;

-- ----------------------------------------------------------------------------
-- Al crear un usuario en auth.users: crear perfil + sembrar categorías
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;

  perform public.seed_default_categories(new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
