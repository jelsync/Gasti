-- Gasti — Fase 5: respaldo coherente e importación bancaria atómica.
-- Funciones con permisos del usuario: mantienen RLS.
create or replace function public.export_user_backup()
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'format', 'gasti-backup', 'version', 1, 'exported_at', now(), 'user_id', auth.uid(),
    'tables', jsonb_build_object(
      'profiles', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.profiles r where r.id = auth.uid()),
      'categories', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.categories r where r.user_id = auth.uid()),
      'transactions', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.transactions r where r.user_id = auth.uid()),
      'receivable_people', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.receivable_people r where r.user_id = auth.uid()),
      'budgets', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.budgets r where r.user_id = auth.uid()),
      'loans', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.loans r where r.user_id = auth.uid()),
      'credit_cards', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.credit_cards r where r.user_id = auth.uid()),
      'card_payments', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.card_payments r where r.user_id = auth.uid()),
      'card_charges', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.card_charges r where r.user_id = auth.uid()),
      'recurring_transactions', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.recurring_transactions r where r.user_id = auth.uid()),
      'recurring_occurrences', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.recurring_occurrences r where r.user_id = auth.uid()),
      'account_reconciliations', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.account_reconciliations r where r.user_id = auth.uid()),
      'month_closures', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.month_closures r where r.user_id = auth.uid()),
      'financial_goals', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.financial_goals r where r.user_id = auth.uid()),
      'financial_goal_movements', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.financial_goal_movements r where r.user_id = auth.uid()),
      'savings_accounts', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.savings_accounts r where r.user_id = auth.uid())
    )
  ) where auth.uid() is not null;
$$;

create or replace function public.import_bank_transactions(p_account_id uuid, p_rows jsonb)
returns jsonb
language plpgsql security invoker
set search_path = public
as $$
declare
  entry jsonb;
  row_id uuid;
  row_type public.transaction_type;
  row_amount numeric;
  row_date date;
  row_category uuid;
  row_description text;
  inserted_count integer := 0;
  skipped_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Sesión no válida.'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'El lote debe ser una lista.';
  end if;
  if jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 1000 then
    raise exception 'Selecciona entre 1 y 1000 movimientos.';
  end if;
  -- Serializa importaciones de la misma cuenta, incluidas pestañas concurrentes.
  perform 1 from public.savings_accounts
    where id = p_account_id and user_id = auth.uid() for update;
  if not found then raise exception 'La cuenta no existe.'; end if;

  for entry in select value from jsonb_array_elements(p_rows) loop
    row_id := (entry->>'id')::uuid;
    row_type := (entry->>'type')::public.transaction_type;
    row_amount := (entry->>'amount')::numeric;
    row_date := (entry->>'transaction_date')::date;
    row_category := (entry->>'category_id')::uuid;
    row_description := coalesce(entry->>'description', '');
    if row_id is null or row_type is null or row_type not in ('INCOME', 'EXPENSE')
      or row_amount is null or row_amount <= 0 or row_amount > 9999999999
      or row_amount <> round(row_amount, 2) or row_date is null
      or length(row_description) > 200
      or (entry->>'transaction_date') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Movimiento inválido. Revisa fecha, tipo, descripción y monto.';
    end if;
    perform 1 from public.categories
      where id = row_category and user_id = auth.uid() and type = row_type;
    if not found then raise exception 'Selecciona una categoría del mismo tipo que el movimiento.'; end if;
    -- Reintentos del mismo lote conservan los UUID aunque se autorice un duplicado.
    if exists (select 1 from public.transactions where id = row_id and user_id = auth.uid()) then
      skipped_count := skipped_count + 1;
      continue;
    end if;
    if not coalesce((entry->>'allow_duplicate')::boolean, false) and exists (
      select 1 from public.transactions t
      where t.user_id = auth.uid() and t.currency = 'HNL'
        and t.transaction_date = row_date and t.amount = row_amount
        and (
          (t.savings_account_id = p_account_id and (
            (row_type = 'EXPENSE' and t.type in ('EXPENSE', 'TRANSFER')) or
            (row_type = 'INCOME' and t.type in ('INCOME', 'SAVING'))
          )) or
          (row_type = 'INCOME' and t.destination_savings_account_id = p_account_id)
        )
    ) then
      skipped_count := skipped_count + 1;
      continue;
    end if;
    insert into public.transactions (
      id, user_id, savings_account_id, category_id, type, amount, currency,
      transaction_date, description
    ) values (
      row_id, auth.uid(), p_account_id, row_category, row_type, row_amount, 'HNL',
      row_date, row_description
    );
    inserted_count := inserted_count + 1;
  end loop;
  return jsonb_build_object('inserted', inserted_count, 'skipped', skipped_count);
end;
$$;

revoke all on function public.export_user_backup() from public, anon;
revoke all on function public.import_bank_transactions(uuid, jsonb) from public, anon;
grant execute on function public.export_user_backup() to authenticated;
grant execute on function public.import_bank_transactions(uuid, jsonb) to authenticated;

