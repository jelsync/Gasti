-- ============================================================================
-- Gasti — Migración 0011: categorías fijas de ingreso y depósitos en cuentas
-- ============================================================================

-- Las transacciones INCOME ya cuentan con savings_account_id desde 0006.
-- Al vincularlas a una cuenta conservan su tipo INCOME (suman al dashboard)
-- y también forman parte del saldo y del historial de esa cuenta en el cliente.

-- Crea las cuatro categorías permitidas para usuarios existentes.
insert into public.categories (user_id, name, type, icon, color, is_default)
select u.id, values_to_add.name, 'INCOME'::public.transaction_type,
       values_to_add.icon, values_to_add.color, true
from auth.users u
cross join (
  values
    ('Salario',                'wallet',      '#059669'),
    ('Transferencia de papá',  'landmark',    '#0d9488'),
    ('Bonos',                  'gift',        '#7c3aed'),
    ('Otros ingresos',         'circle-plus', '#16a34a')
) as values_to_add(name, icon, color)
on conflict (user_id, type, name) do update
set icon = excluded.icon,
    color = excluded.color,
    is_default = true;

-- Conserva el historial: las categorías de ingreso anteriores pasan a
-- "Otros ingresos" antes de eliminarlas.
update public.transactions as tx
set category_id = target.id
from public.categories as previous,
     public.categories as target
where tx.category_id = previous.id
  and previous.type = 'INCOME'
  and previous.name not in ('Salario', 'Transferencia de papá', 'Bonos', 'Otros ingresos')
  and target.user_id = previous.user_id
  and target.type = 'INCOME'
  and target.name = 'Otros ingresos';

delete from public.categories
where type = 'INCOME'
  and name not in ('Salario', 'Transferencia de papá', 'Bonos', 'Otros ingresos');

-- Impide que clientes creen otras categorías de ingreso fuera de estas cuatro.
alter table public.categories
  drop constraint if exists categories_income_name_allowed;
alter table public.categories
  add constraint categories_income_name_allowed check (
    type <> 'INCOME'
    or name in ('Salario', 'Transferencia de papá', 'Bonos', 'Otros ingresos')
  );

-- Mantiene las mismas categorías para usuarios creados a partir de ahora.
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
    (uid, 'Salario',               'INCOME', 'wallet',      '#059669', true),
    (uid, 'Transferencia de papá', 'INCOME', 'landmark',    '#0d9488', true),
    (uid, 'Bonos',                 'INCOME', 'gift',        '#7c3aed', true),
    (uid, 'Otros ingresos',        'INCOME', 'circle-plus', '#16a34a', true)
  on conflict (user_id, type, name) do nothing;
end;
$$;
