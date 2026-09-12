-- ============================================================================
-- Gasti — Migración 0017: ingresos genéricos y números de cuenta
-- ============================================================================

alter table public.categories
  drop constraint if exists categories_income_name_allowed;

update public.categories
set name = 'Transferencias recibidas'
where type = 'INCOME'
  and name = 'Transferencia de papá';

alter table public.categories
  add constraint categories_income_name_allowed check (
    type <> 'INCOME'
    or name in ('Salario', 'Transferencias recibidas', 'Bonos', 'Otros ingresos')
  );

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'savings_accounts'
      and column_name = 'institution'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'savings_accounts'
      and column_name = 'account_number'
  ) then
    alter table public.savings_accounts
      rename column institution to account_number;
  end if;
end $$;

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
    (uid, 'Salario',                  'INCOME', 'wallet',      '#059669', true),
    (uid, 'Transferencias recibidas', 'INCOME', 'landmark',    '#0d9488', true),
    (uid, 'Bonos',                    'INCOME', 'gift',        '#7c3aed', true),
    (uid, 'Otros ingresos',           'INCOME', 'circle-plus', '#16a34a', true)
  on conflict (user_id, type, name) do nothing;
end;
$$;

comment on column public.savings_accounts.account_number is
  'Número de cuenta opcional que el usuario puede copiar y compartir.';
