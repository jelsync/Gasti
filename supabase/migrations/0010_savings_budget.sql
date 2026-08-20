-- ============================================================================
-- Gasti — Migración 0010: meta de ahorro en presupuestos
--
-- Un presupuesto puede ser por categoría de gasto (CATEGORY) o una meta de
-- ahorro mensual (SAVINGS). La meta de ahorro se mide contra las transacciones
-- de tipo SAVING del mes.
-- ============================================================================

alter table public.budgets add column if not exists kind text not null default 'CATEGORY';
alter table public.budgets alter column category_id drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'budgets_kind_valid') then
    alter table public.budgets add constraint budgets_kind_valid check (kind in ('CATEGORY', 'SAVINGS'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'budgets_kind_category') then
    alter table public.budgets add constraint budgets_kind_category check (
      (kind = 'CATEGORY' and category_id is not null) or
      (kind = 'SAVINGS' and category_id is null)
    );
  end if;
end $$;

-- Una sola meta de ahorro por mes/usuario.
create unique index if not exists budgets_savings_unique
  on public.budgets (user_id, year, month)
  where kind = 'SAVINGS';
