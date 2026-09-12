-- ============================================================================
-- Gasti — Migración 0021: metas financieras independientes
-- ============================================================================

create table if not exists public.financial_goals (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  savings_account_id  uuid references public.savings_accounts (id) on delete set null,
  name                text not null,
  goal_type           text not null default 'OTHER',
  target_amount       numeric(14,2) not null,
  starting_amount     numeric(14,2) not null default 0,
  target_date         date,
  color               text not null default '#0ea5e9',
  status              text not null default 'ACTIVE',
  notes               text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint financial_goals_name_not_blank check (length(btrim(name)) > 0),
  constraint financial_goals_type_valid
    check (goal_type in ('EMERGENCY', 'TRAVEL', 'VEHICLE', 'HOME', 'EDUCATION', 'OTHER')),
  constraint financial_goals_target_positive check (target_amount > 0),
  constraint financial_goals_starting_nonnegative check (starting_amount >= 0),
  constraint financial_goals_starting_within_target check (starting_amount <= target_amount),
  constraint financial_goals_color_valid check (color ~ '^#[0-9a-fA-F]{6}$'),
  constraint financial_goals_status_valid check (status in ('ACTIVE', 'PAUSED', 'COMPLETED')),
  constraint financial_goals_notes_length check (length(notes) <= 500)
);

create index if not exists financial_goals_user_status_idx
  on public.financial_goals (user_id, status, target_date);

create table if not exists public.financial_goal_movements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  goal_id        uuid not null references public.financial_goals (id) on delete cascade,
  movement_kind  text not null,
  amount         numeric(14,2) not null,
  movement_date  date not null default current_date,
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  constraint financial_goal_movements_kind_valid
    check (movement_kind in ('CONTRIBUTION', 'WITHDRAWAL')),
  constraint financial_goal_movements_amount_positive check (amount > 0),
  constraint financial_goal_movements_notes_length check (length(notes) <= 300)
);

create index if not exists financial_goal_movements_goal_date_idx
  on public.financial_goal_movements (goal_id, movement_date desc, created_at desc);

drop trigger if exists set_financial_goals_updated_at on public.financial_goals;
create trigger set_financial_goals_updated_at
  before update on public.financial_goals
  for each row execute function public.set_updated_at();

alter table public.financial_goals enable row level security;
alter table public.financial_goal_movements enable row level security;

create or replace function public.create_financial_goal_movement(
  p_goal_id uuid,
  p_movement_kind text,
  p_amount numeric,
  p_movement_date date,
  p_notes text default ''
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  goal_row public.financial_goals%rowtype;
  current_saved numeric(14,2);
  next_saved numeric(14,2);
  movement_id uuid;
begin
  select * into goal_row
  from public.financial_goals
  where id = p_goal_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'La meta no existe.';
  end if;
  if goal_row.status = 'PAUSED' then
    raise exception 'Activa la meta antes de registrar movimientos.';
  end if;
  if p_movement_kind not in ('CONTRIBUTION', 'WITHDRAWAL') then
    raise exception 'Tipo de movimiento inválido.';
  end if;
  if p_amount <= 0 then
    raise exception 'El monto debe ser mayor que cero.';
  end if;

  select goal_row.starting_amount + coalesce(sum(
    case when movement_kind = 'CONTRIBUTION' then amount else -amount end
  ), 0)
  into current_saved
  from public.financial_goal_movements
  where goal_id = goal_row.id;

  next_saved := current_saved + case
    when p_movement_kind = 'CONTRIBUTION' then p_amount
    else -p_amount
  end;
  if next_saved < 0 then
    raise exception 'El retiro supera el progreso disponible de la meta.';
  end if;

  insert into public.financial_goal_movements (
    user_id, goal_id, movement_kind, amount, movement_date, notes
  ) values (
    auth.uid(), goal_row.id, p_movement_kind, p_amount,
    coalesce(p_movement_date, current_date), left(coalesce(p_notes, ''), 300)
  ) returning id into movement_id;

  update public.financial_goals
  set status = case
    when next_saved >= target_amount then 'COMPLETED'
    else 'ACTIVE'
  end
  where id = goal_row.id;

  return movement_id;
end;
$$;

revoke all on function public.create_financial_goal_movement(uuid, text, numeric, date, text)
  from public;
grant execute on function public.create_financial_goal_movement(uuid, text, numeric, date, text)
  to authenticated;

drop policy if exists "financial_goals_select_own" on public.financial_goals;
create policy "financial_goals_select_own" on public.financial_goals
  for select using (auth.uid() = user_id);
drop policy if exists "financial_goals_insert_own" on public.financial_goals;
create policy "financial_goals_insert_own" on public.financial_goals
  for insert with check (
    auth.uid() = user_id
    and (
      savings_account_id is null
      or exists (
        select 1 from public.savings_accounts account
        where account.id = savings_account_id and account.user_id = auth.uid()
      )
    )
  );
drop policy if exists "financial_goals_update_own" on public.financial_goals;
create policy "financial_goals_update_own" on public.financial_goals
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and (
      savings_account_id is null
      or exists (
        select 1 from public.savings_accounts account
        where account.id = savings_account_id and account.user_id = auth.uid()
      )
    )
  );
drop policy if exists "financial_goals_delete_own" on public.financial_goals;
create policy "financial_goals_delete_own" on public.financial_goals
  for delete using (auth.uid() = user_id);

drop policy if exists "financial_goal_movements_select_own" on public.financial_goal_movements;
create policy "financial_goal_movements_select_own" on public.financial_goal_movements
  for select using (auth.uid() = user_id);
drop policy if exists "financial_goal_movements_insert_own" on public.financial_goal_movements;
create policy "financial_goal_movements_insert_own" on public.financial_goal_movements
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.financial_goals goal
      where goal.id = goal_id and goal.user_id = auth.uid()
    )
  );
drop policy if exists "financial_goal_movements_update_own" on public.financial_goal_movements;
create policy "financial_goal_movements_update_own" on public.financial_goal_movements
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.financial_goals goal
      where goal.id = goal_id and goal.user_id = auth.uid()
    )
  );
drop policy if exists "financial_goal_movements_delete_own" on public.financial_goal_movements;
create policy "financial_goal_movements_delete_own" on public.financial_goal_movements
  for delete using (auth.uid() = user_id);

comment on table public.financial_goals is
  'Metas independientes con una cuenta de referencia opcional.';
comment on table public.financial_goal_movements is
  'Aportes y retiros que cambian el progreso de una meta, pero no mueven el saldo bancario.';
