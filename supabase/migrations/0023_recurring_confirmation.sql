-- Confirmación anticipada y vínculo explícito con movimientos ya registrados.
-- Las funciones conservan SECURITY INVOKER: todas las consultas respetan RLS.
create unique index recurring_occurrences_transaction_unique
  on public.recurring_occurrences (transaction_id) where transaction_id is not null;

create or replace function public.get_recurring_candidates(p_recurring_id uuid, p_due_date date)
returns setof public.transactions
language sql stable
set search_path = public
as $$
  select movement.*
  from public.transactions movement
  join public.recurring_transactions rule on rule.id = p_recurring_id
  where rule.user_id = auth.uid() and movement.user_id = auth.uid()
    and movement.type = rule.type
    and movement.category_id = rule.category_id
    and movement.currency = rule.currency
    and movement.savings_account_id is not distinct from rule.savings_account_id
    and movement.credit_card_id is not distinct from rule.credit_card_id
    and movement.transaction_date between p_due_date - 31 and p_due_date + 31
    and movement.transaction_date <= (now() at time zone 'America/Tegucigalpa')::date
    and not exists (
      select 1 from public.recurring_occurrences occurrence
      where occurrence.transaction_id = movement.id
    )
    and (rule.credit_card_id is null or exists (
      select 1 from public.card_charges charge
      where charge.transaction_id = movement.id and charge.user_id = auth.uid()
        and charge.card_id = rule.credit_card_id and charge.currency = rule.currency
        and charge.amount = movement.amount
    ))
  order by abs(movement.transaction_date - p_due_date), movement.transaction_date desc, movement.id;
$$;

drop function public.confirm_recurring_transaction(uuid, date);
create function public.confirm_recurring_transaction(
  p_recurring_id uuid,
  p_due_date date,
  p_transaction_date date default null,
  p_existing_transaction_id uuid default null,
  p_amount numeric default null,
  p_allow_duplicate boolean default false,
  p_description text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  rule public.recurring_transactions%rowtype;
  existing_occurrence public.recurring_occurrences%rowtype;
  movement public.transactions%rowtype;
  expected_due_date date;
  actual_date date;
  actual_amount numeric;
  movement_id uuid;
begin
  if auth.uid() is null then raise exception 'Sesión no válida.'; end if;
  -- Serializa confirmaciones de distintas reglas del mismo usuario.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 23));
  select * into rule from public.recurring_transactions
    where id = p_recurring_id and user_id = auth.uid() for update;
  if not found then raise exception 'La transacción recurrente no existe.'; end if;
  if p_due_date is null then raise exception 'Selecciona la fecha programada.'; end if;

  select * into existing_occurrence from public.recurring_occurrences
    where recurring_transaction_id = rule.id
      and period_start = date_trunc('month', p_due_date)::date;
  if found then
    if existing_occurrence.status = 'COMPLETED' then
      if p_existing_transaction_id is not null
        and p_existing_transaction_id <> existing_occurrence.transaction_id then
        raise exception 'Esta recurrencia ya está vinculada a otro movimiento.';
      end if;
      return existing_occurrence.transaction_id;
    end if;
    raise exception 'Este movimiento está omitido. Restáuralo antes de confirmarlo.';
  end if;
  if not rule.is_active then raise exception 'La transacción recurrente está pausada.'; end if;

  expected_due_date := make_date(extract(year from p_due_date)::integer,
    extract(month from p_due_date)::integer,
    least(rule.day_of_month, extract(day from (date_trunc('month', p_due_date) + interval '1 month - 1 day'))::integer));
  if p_due_date <> expected_due_date or p_due_date < rule.start_date
    or (rule.end_date is not null and p_due_date > rule.end_date) then
    raise exception 'La fecha indicada no corresponde a un movimiento pendiente.';
  end if;
  if rule.category_id is null or not exists (
    select 1 from public.categories category where category.id = rule.category_id
      and category.user_id = auth.uid() and category.type = rule.type
  ) then raise exception 'Selecciona una categoría válida antes de confirmar este movimiento.'; end if;
  if rule.type = 'EXPENSE' and rule.savings_account_id is null and rule.credit_card_id is null then
    raise exception 'Selecciona una cuenta o tarjeta antes de confirmar este gasto.';
  end if;

  if p_existing_transaction_id is not null then
    -- Bloquea el registro antes de volver a validar el candidato.
    select * into movement from public.transactions
      where id = p_existing_transaction_id and user_id = auth.uid() for update;
    if not found or not exists (
      select 1 from public.get_recurring_candidates(p_recurring_id, p_due_date) candidate
      where candidate.id = p_existing_transaction_id
    ) then raise exception 'El movimiento ya fue vinculado o no coincide con la categoría, moneda, fecha y cuenta o tarjeta de esta recurrencia.'; end if;
    movement_id := movement.id;
  else
    actual_date := coalesce(p_transaction_date, p_due_date);
    actual_amount := coalesce(p_amount, rule.amount);
    if actual_date > (now() at time zone 'America/Tegucigalpa')::date
      or actual_date < p_due_date - 31 or actual_date > p_due_date + 31 then
      raise exception 'La fecha real debe ser hasta hoy y estar dentro de los 31 días anteriores o posteriores a la fecha programada.';
    end if;
    if actual_amount <= 0 or actual_amount >= 1000000000000
      or actual_amount <> round(actual_amount, 2) then
      raise exception 'El monto debe ser positivo y tener como máximo dos decimales.';
    end if;
    if not coalesce(p_allow_duplicate, false) and exists (
      select 1 from public.get_recurring_candidates(p_recurring_id, p_due_date)
    ) then
      raise exception 'Encontramos movimientos que podrían corresponder a esta recurrencia. Vincula uno o confirma expresamente que se trata de otro movimiento.';
    end if;
    insert into public.transactions (user_id, type, amount, currency, category_id,
      credit_card_id, savings_account_id, description, transaction_date)
    values (rule.user_id, rule.type, actual_amount, rule.currency, rule.category_id,
      rule.credit_card_id, rule.savings_account_id, coalesce(p_description, rule.description), actual_date)
    returning id into movement_id;
    if rule.credit_card_id is not null then
      insert into public.card_charges (user_id, card_id, amount, amount_hnl, currency,
        description, charge_date, transaction_id)
      values (rule.user_id, rule.credit_card_id, actual_amount, null, rule.currency,
        coalesce(p_description, rule.description), actual_date, movement_id);
    end if;
  end if;
  insert into public.recurring_occurrences
    (user_id, recurring_transaction_id, due_date, status, transaction_id)
  values (rule.user_id, rule.id, p_due_date, 'COMPLETED', movement_id);
  return movement_id;
end;
$$;

revoke all on function public.get_recurring_candidates(uuid, date) from public, anon;
revoke all on function public.confirm_recurring_transaction(uuid, date, date, uuid, numeric, boolean, text) from public, anon;
grant execute on function public.get_recurring_candidates(uuid, date) to authenticated;
grant execute on function public.confirm_recurring_transaction(uuid, date, date, uuid, numeric, boolean, text) to authenticated;
