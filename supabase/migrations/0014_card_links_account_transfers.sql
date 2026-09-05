-- ============================================================================
-- Gasti — Migración 0014: vínculos reversibles de tarjetas y transferencias
-- ============================================================================

alter table public.transactions
  add column if not exists destination_savings_account_id uuid
  references public.savings_accounts (id) on delete set null;

alter table public.card_payments
  add column if not exists transaction_id uuid
  references public.transactions (id) on delete cascade;

alter table public.card_charges
  add column if not exists transaction_id uuid
  references public.transactions (id) on delete cascade;

alter table public.card_charges
  add column if not exists amount_hnl numeric(14, 2);

create index if not exists transactions_destination_savings_idx
  on public.transactions (destination_savings_account_id);
create unique index if not exists card_payments_transaction_unique
  on public.card_payments (transaction_id) where transaction_id is not null;
create unique index if not exists card_charges_transaction_unique
  on public.card_charges (transaction_id) where transaction_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_transfer_accounts_valid'
  ) then
    alter table public.transactions
      add constraint transactions_transfer_accounts_valid check (
        type <> 'TRANSFER'
        or credit_card_id is not null
        or (
          savings_account_id is not null
          and destination_savings_account_id is not null
          and destination_savings_account_id <> savings_account_id
        )
      );
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'card_charges_amount_hnl_positive'
  ) then
    alter table public.card_charges
      add constraint card_charges_amount_hnl_positive
      check (amount_hnl is null or amount_hnl > 0);
  end if;
end $$;

-- Vincula los pagos históricos con la transacción que generó la versión anterior.
-- Se emparejan por usuario, tarjeta, fecha, monto y orden de creación.
with payment_rows as (
  select
    payment.id,
    payment.user_id,
    payment.card_id,
    payment.payment_date,
    coalesce(payment.amount_hnl, payment.amount) as effective_amount,
    row_number() over (
      partition by payment.user_id, payment.card_id, payment.payment_date,
        coalesce(payment.amount_hnl, payment.amount)
      order by payment.created_at, payment.id
    ) as occurrence
  from public.card_payments payment
  where payment.transaction_id is null
),
transaction_rows as (
  select
    transaction.id,
    transaction.user_id,
    card.id as card_id,
    transaction.transaction_date,
    transaction.amount,
    row_number() over (
      partition by transaction.user_id, card.id, transaction.transaction_date, transaction.amount
      order by transaction.created_at, transaction.id
    ) as occurrence
  from public.transactions transaction
  join public.credit_cards card
    on card.user_id = transaction.user_id
   and starts_with(transaction.description, 'Pago tarjeta ' || card.name || ' (')
  where transaction.type = 'EXPENSE'
),
matches as (
  select payment.id as payment_id, transaction.id as transaction_id
  from payment_rows payment
  join transaction_rows transaction
    on transaction.user_id = payment.user_id
   and transaction.card_id = payment.card_id
   and transaction.transaction_date = payment.payment_date
   and transaction.amount = payment.effective_amount
   and transaction.occurrence = payment.occurrence
)
update public.card_payments payment
set transaction_id = matches.transaction_id
from matches
where payment.id = matches.payment_id;

update public.transactions transaction
set type = 'TRANSFER',
    category_id = null,
    credit_card_id = payment.card_id
from public.card_payments payment
where payment.transaction_id = transaction.id;

-- Las compras históricas en HNL sí pueden reconocerse sin adivinar una tasa de cambio.
-- Se reutiliza el UUID del cargo como UUID de la transacción para enlazarlas sin ambigüedad.
insert into public.transactions (
  id,
  user_id,
  category_id,
  credit_card_id,
  type,
  amount,
  description,
  transaction_date,
  created_at,
  updated_at
)
select
  charge.id,
  charge.user_id,
  (
    select category.id
    from public.categories category
    where category.user_id = charge.user_id
      and category.type = 'EXPENSE'
      and lower(btrim(category.name)) = lower(btrim(charge.description))
    limit 1
  ),
  charge.card_id,
  'EXPENSE',
  charge.amount,
  charge.description,
  charge.charge_date,
  charge.created_at,
  charge.created_at
from public.card_charges charge
where charge.currency = 'HNL'
  and charge.transaction_id is null
on conflict (id) do nothing;

update public.card_charges charge
set transaction_id = charge.id,
    amount_hnl = charge.amount
where charge.currency = 'HNL'
  and charge.transaction_id is null
  and exists (
    select 1
    from public.transactions transaction
    where transaction.id = charge.id
      and transaction.user_id = charge.user_id
  );

comment on column public.transactions.destination_savings_account_id is
  'Cuenta destino para transferencias entre cuentas.';
comment on column public.card_payments.transaction_id is
  'Transferencia vinculada; al borrarla se revierte el pago de tarjeta.';
comment on column public.card_charges.transaction_id is
  'Gasto vinculado; al borrarlo se revierte la compra y la deuda.';
comment on column public.card_charges.amount_hnl is
  'Valor del cargo en HNL usado por dashboard y presupuestos.';
