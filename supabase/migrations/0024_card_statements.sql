-- Cortes de tarjeta confirmados manualmente: fotografías, nunca movimientos de dinero.
alter table public.credit_cards add column statement_day integer
  check (statement_day between 1 and 31);

create table public.card_statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.credit_cards(id) on delete cascade,
  statement_date date not null,
  period_start date not null,
  statement_day integer not null check (statement_day between 1 and 31),
  opening_hnl numeric(14,2) not null,
  opening_usd numeric(14,2) not null,
  charges_hnl numeric(14,2) not null,
  charges_usd numeric(14,2) not null,
  payments_hnl numeric(14,2) not null,
  payments_usd numeric(14,2) not null,
  balance_hnl numeric(14,2) not null,
  balance_usd numeric(14,2) not null,
  confirmed_at timestamptz not null default now(),
  unique (card_id, statement_date),
  check (period_start <= statement_date)
);
alter table public.card_statements enable row level security;
create policy own_card_statements on public.card_statements to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.credit_cards c where c.id = card_id and c.user_id = auth.uid()
  ));
grant select, insert, update, delete on public.card_statements to authenticated;

create or replace function public.preview_card_statement(p_card_id uuid, p_statement_date date)
returns jsonb language plpgsql stable security invoker
set search_path = public
as $$
declare
  card public.credit_cards;
  cutoff_day integer;
  month_start date;
  previous_start date;
  expected_date date;
  start_date date;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión no válida.'; end if;
  select * into card from public.credit_cards where id = p_card_id and user_id = auth.uid();
  if not found then raise exception 'La tarjeta no existe.'; end if;
  if p_statement_date is null then raise exception 'Selecciona la fecha de corte.'; end if;
  -- Conserva el ciclo original al actualizar un corte histórico.
  select statement_day into cutoff_day from public.card_statements
    where card_id = p_card_id and statement_date = p_statement_date and user_id = auth.uid();
  cutoff_day := coalesce(cutoff_day, card.statement_day);
  if cutoff_day is null then raise exception 'Configura primero el día de corte de la tarjeta.'; end if;
  month_start := date_trunc('month', p_statement_date)::date;
  previous_start := (month_start - interval '1 month')::date;
  expected_date := month_start + least(cutoff_day, extract(day from month_start + interval '1 month - 1 day')::int) - 1;
  if p_statement_date <> expected_date then raise exception 'La fecha no corresponde al día de corte configurado.'; end if;
  start_date := previous_start + least(cutoff_day, extract(day from month_start - interval '1 day')::int);

  -- Un único SELECT toma una fotografía consistente de compras y pagos.
  with movements as (
    select currency::text, amount, charge_date as movement_date, true as is_charge
      from public.card_charges where card_id = p_card_id and user_id = auth.uid() and charge_date <= p_statement_date
    union all
    select currency::text, amount, payment_date, false
      from public.card_payments where card_id = p_card_id and user_id = auth.uid() and payment_date <= p_statement_date
  ), totals as (
    select
      card.opening_balance + coalesce(sum(case when is_charge then amount else -amount end) filter (where currency = 'HNL' and movement_date < start_date), 0) as oh,
      card.opening_balance_usd + coalesce(sum(case when is_charge then amount else -amount end) filter (where currency = 'USD' and movement_date < start_date), 0) as ou,
      coalesce(sum(amount) filter (where currency = 'HNL' and is_charge and movement_date >= start_date), 0) as ch,
      coalesce(sum(amount) filter (where currency = 'USD' and is_charge and movement_date >= start_date), 0) as cu,
      coalesce(sum(amount) filter (where currency = 'HNL' and not is_charge and movement_date >= start_date), 0) as ph,
      coalesce(sum(amount) filter (where currency = 'USD' and not is_charge and movement_date >= start_date), 0) as pu
    from movements
  ) select jsonb_build_object(
    'card_id', p_card_id, 'statement_date', p_statement_date, 'period_start', start_date,
    'statement_day', cutoff_day, 'opening_hnl', oh, 'opening_usd', ou,
    'charges_hnl', ch, 'charges_usd', cu, 'payments_hnl', ph, 'payments_usd', pu,
    'balance_hnl', oh + ch - ph, 'balance_usd', ou + cu - pu
  ) into result from totals;
  return result;
end;
$$;

create or replace function public.confirm_card_statement(
  p_card_id uuid, p_statement_date date, p_expected_snapshot jsonb
)
returns public.card_statements language plpgsql security invoker
set search_path = public
as $$
declare
  snapshot jsonb;
  saved public.card_statements;
begin
  if auth.uid() is null then raise exception 'Sesión no válida.'; end if;
  if p_statement_date > (now() at time zone 'America/Tegucigalpa')::date then
    raise exception 'Puedes confirmar el corte a partir de su fecha, después de revisar las compras del día.';
  end if;
  -- Serializa confirmaciones de una tarjeta. Movimientos posteriores siguen permitidos.
  perform 1 from public.credit_cards where id = p_card_id and user_id = auth.uid() for update;
  if not found then raise exception 'La tarjeta no existe.'; end if;
  snapshot := public.preview_card_statement(p_card_id, p_statement_date);
  if snapshot is distinct from p_expected_snapshot then
    raise exception 'Los importes cambiaron. Vuelve a revisar el corte antes de confirmarlo.';
  end if;
  insert into public.card_statements (
    user_id, card_id, statement_date, period_start, statement_day,
    opening_hnl, opening_usd, charges_hnl, charges_usd,
    payments_hnl, payments_usd, balance_hnl, balance_usd
  ) values (
    auth.uid(), p_card_id, p_statement_date, (snapshot->>'period_start')::date, (snapshot->>'statement_day')::int,
    (snapshot->>'opening_hnl')::numeric, (snapshot->>'opening_usd')::numeric,
    (snapshot->>'charges_hnl')::numeric, (snapshot->>'charges_usd')::numeric,
    (snapshot->>'payments_hnl')::numeric, (snapshot->>'payments_usd')::numeric,
    (snapshot->>'balance_hnl')::numeric, (snapshot->>'balance_usd')::numeric
  ) on conflict (card_id, statement_date) do update set
    period_start = excluded.period_start, statement_day = excluded.statement_day,
    opening_hnl = excluded.opening_hnl, opening_usd = excluded.opening_usd,
    charges_hnl = excluded.charges_hnl, charges_usd = excluded.charges_usd,
    payments_hnl = excluded.payments_hnl, payments_usd = excluded.payments_usd,
    balance_hnl = excluded.balance_hnl, balance_usd = excluded.balance_usd,
    confirmed_at = now()
  returning * into saved;
  return saved;
end;
$$;

revoke all on function public.preview_card_statement(uuid, date) from public, anon;
revoke all on function public.confirm_card_statement(uuid, date, jsonb) from public, anon;
grant execute on function public.preview_card_statement(uuid, date) to authenticated;
grant execute on function public.confirm_card_statement(uuid, date, jsonb) to authenticated;

-- El respaldo incluye los cortes confirmados del usuario.
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
      'card_statements', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.card_statements r where r.user_id = auth.uid()),
      'savings_accounts', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb) from public.savings_accounts r where r.user_id = auth.uid())
    )
  ) where auth.uid() is not null;
$$;


