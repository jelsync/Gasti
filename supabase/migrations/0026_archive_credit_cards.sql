-- Archivar conserva compras, pagos y cortes; solo marca la tarjeta como fuera de uso.
alter table public.credit_cards
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz;

create index if not exists credit_cards_user_archived_idx
  on public.credit_cards (user_id, is_archived, created_at);
