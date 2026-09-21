-- ============================================================================
-- Gasti - Migracion 0025: cuenta de debito de prestamos
-- ============================================================================

alter table public.loans
  add column if not exists savings_account_id uuid
  references public.savings_accounts (id) on delete set null;

create index if not exists loans_savings_account_idx
  on public.loans (savings_account_id);
