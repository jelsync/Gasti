// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const category = '33333333-3333-4333-8333-333333333333';
const card = '44444444-4444-4444-8444-444444444444';
const rule = '55555555-5555-4555-8555-555555555555';
const secondRule = '66666666-6666-4666-8666-666666666666';
let db: PGlite;

const confirm = (
  overrides: {
    id?: string;
    due?: string;
    date?: string;
    existing?: string;
    amount?: number;
    allow?: boolean;
  } = {},
) =>
  db.query<{ id: string }>('select public.confirm_recurring_transaction($1,$2,$3,$4,$5,$6) as id', [
    overrides.id ?? rule,
    overrides.due ?? '2025-09-19',
    overrides.date ?? '2025-09-12',
    overrides.existing ?? null,
    overrides.amount ?? null,
    overrides.allow ?? false,
  ]);
const candidates = () =>
  db.query<{ id: string }>('select * from public.get_recurring_candidates($1,$2)', [
    rule,
    '2025-09-19',
  ]);
const purchase = async (
  overrides: {
    type?: string;
    currency?: string;
    category?: string;
    card?: string;
    date?: string;
    amount?: number;
  } = {},
) => {
  const id = crypto.randomUUID();
  await db.query(
    `insert into transactions (id,user_id,type,amount,currency,category_id,credit_card_id,transaction_date)
    values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id,
      user,
      overrides.type ?? 'EXPENSE',
      overrides.amount ?? 11.49,
      overrides.currency ?? 'USD',
      overrides.category ?? category,
      overrides.card ?? card,
      overrides.date ?? '2025-09-12',
    ],
  );
  if (!overrides.type || overrides.type === 'EXPENSE') {
    await db.query(
      `insert into card_charges (user_id,card_id,amount,currency,transaction_id) values ($1,$2,$3,$4,$5)`,
      [user, overrides.card ?? card, overrides.amount ?? 11.49, overrides.currency ?? 'USD', id],
    );
  }
  return id;
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${user}'), ('${other}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
    create type transaction_type as enum ('INCOME','EXPENSE','SAVING','TRANSFER');
    create table categories (id uuid primary key, user_id uuid, type transaction_type);
    create table savings_accounts (id uuid primary key, user_id uuid);
    create table credit_cards (id uuid primary key, user_id uuid);
    create table transactions (id uuid primary key default gen_random_uuid(), user_id uuid not null,
      type transaction_type not null, amount numeric(14,2), currency text, category_id uuid references categories,
      credit_card_id uuid references credit_cards, savings_account_id uuid references savings_accounts,
      description text, transaction_date date);
    create table card_charges (id uuid primary key default gen_random_uuid(), user_id uuid not null,
      card_id uuid references credit_cards, amount numeric(14,2), amount_hnl numeric(14,2), currency text,
      description text, charge_date date, transaction_id uuid unique references transactions on delete cascade);
    ${['categories', 'savings_accounts', 'credit_cards', 'transactions', 'card_charges'].map((table) => `alter table ${table} enable row level security; create policy own_rows on ${table} to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());`).join('\n')}
    insert into categories values ('${category}', '${user}', 'EXPENSE');
    insert into credit_cards values ('${card}', '${user}');
  `);
  await db.exec(readFileSync('supabase/migrations/0018_recurring_transactions.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/0023_recurring_confirmation.sql', 'utf8'));
  await db.exec(
    'grant usage on schema public, auth to authenticated, anon; grant all on all tables in schema public to authenticated;',
  );
}, 60000);

beforeEach(async () => {
  await db.exec(`reset role; truncate transactions, recurring_transactions cascade;
    set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);
    insert into recurring_transactions (id,user_id,name,type,amount,currency,category_id,credit_card_id,day_of_month,start_date)
    values ('${rule}','${user}','Spotify','EXPENSE',11.49,'USD','${category}','${card}',19,'2025-01-01'),
      ('${secondRule}','${user}','Otra suscripción','EXPENSE',11.49,'USD','${category}','${card}',19,'2025-01-01');`);
});
afterAll(async () => {
  await db?.close();
});

describe('confirmación de recurrentes con PostgreSQL y RLS', () => {
  it('registra anticipadamente en la fecha real, conserva vencimiento y reintenta sin duplicar', async () => {
    const first = (await confirm()).rows[0].id;
    expect((await confirm()).rows[0].id).toBe(first);
    expect(
      (await db.query('select transaction_date::text, amount::text from transactions')).rows,
    ).toEqual([{ transaction_date: '2025-09-12', amount: '11.49' }]);
    expect((await db.query('select due_date::text from recurring_occurrences')).rows).toEqual([
      { due_date: '2025-09-19' },
    ]);
    expect((await db.query('select * from card_charges')).rows).toHaveLength(1);
  });
  it('vincula explícitamente una compra existente sin otro gasto ni cargo', async () => {
    const id = await purchase();
    await expect(confirm()).rejects.toThrow('Encontramos movimientos');
    expect((await confirm({ existing: id })).rows[0].id).toBe(id);
    expect((await db.query('select * from transactions')).rows).toHaveLength(1);
    expect((await db.query('select * from card_charges')).rows).toHaveLength(1);
    expect((await candidates()).rows).toHaveLength(0);
  });
  it('permite diferencias de importe, pero exige confirmar expresamente un movimiento distinto', async () => {
    await purchase({ amount: 12 });
    await expect(confirm({ amount: 13 })).rejects.toThrow('Encontramos movimientos');
    await confirm({ amount: 13, allow: true });
    expect((await db.query('select amount::text from card_charges order by amount')).rows).toEqual([
      { amount: '12.00' },
      { amount: '13.00' },
    ]);
  });
  it('nunca confunde pagos TRANSFER, otra moneda o fechas lejanas con la compra', async () => {
    await purchase({ type: 'TRANSFER' });
    await purchase({ currency: 'HNL' });
    await purchase({ date: '2025-07-01' });
    expect((await candidates()).rows).toHaveLength(0);
    await confirm();
    expect((await db.query('select * from recurring_occurrences')).rows).toHaveLength(1);
  });
  it('impide usar un movimiento para dos recurrencias y mantiene la reversión en cascada', async () => {
    const id = await purchase();
    await confirm({ existing: id });
    await expect(confirm({ id: secondRule, existing: id })).rejects.toThrow('ya fue vinculado');
    await db.query('delete from transactions where id = $1', [id]);
    expect((await db.query('select * from recurring_occurrences')).rows).toHaveLength(0);
    expect((await db.query('select * from card_charges')).rows).toHaveLength(0);
    await confirm();
  });
  it('no vincula una compra de otra tarjeta ni otra categoría', async () => {
    const otherCard = crypto.randomUUID();
    const otherCategory = crypto.randomUUID();
    await db.query('insert into credit_cards values ($1,$2)', [otherCard, user]);
    await db.query("insert into categories values ($1,$2,'EXPENSE')", [otherCategory, user]);
    const wrongCard = await purchase({ card: otherCard });
    const wrongCategory = await purchase({ category: otherCategory });
    expect((await candidates()).rows).toHaveLength(0);
    await expect(confirm({ existing: wrongCard })).rejects.toThrow('no coincide');
    await expect(confirm({ existing: wrongCategory })).rejects.toThrow('no coincide');
  });
  it('revierte el gasto si falla el cargo de tarjeta dentro de la misma confirmación', async () => {
    await db.exec(
      'reset role; alter table card_charges add constraint test_reject_charge check (amount <> 12.50); set role authenticated;',
    );
    try {
      await expect(confirm({ amount: 12.5 })).rejects.toThrow('test_reject_charge');
      expect((await db.query('select * from transactions')).rows).toHaveLength(0);
      expect((await db.query('select * from recurring_occurrences')).rows).toHaveLength(0);
    } finally {
      await db.exec(
        'reset role; alter table card_charges drop constraint test_reject_charge; set role authenticated;',
      );
    }
  });
  it('rechaza futuros movimientos reales, fechas fuera de la ventana y montos inválidos', async () => {
    await expect(confirm({ due: '2099-09-19', date: '2099-09-12' })).rejects.toThrow('fecha real');
    await expect(confirm({ date: '2025-07-01' })).rejects.toThrow('fecha real');
    await expect(confirm({ amount: 1.001 })).rejects.toThrow('monto');
    await expect(confirm({ amount: -1 })).rejects.toThrow('monto');
    await expect(confirm({ due: '2025-09-20' })).rejects.toThrow('fecha indicada');
    expect((await db.query('select * from transactions')).rows).toHaveLength(0);
  });
  it('admite pagos anticipados de otro mes conservando el período y meses cortos', async () => {
    await db.exec(`update recurring_transactions set day_of_month=31 where id='${rule}'`);
    await confirm({ due: '2025-02-28', date: '2025-01-31' });
    expect((await db.query('select period_start::text from recurring_occurrences')).rows).toEqual([
      { period_start: '2025-02-01' },
    ]);
  });
  it('respeta RLS y rechaza invocaciones anónimas', async () => {
    await purchase();
    await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`);
    expect((await candidates()).rows).toHaveLength(0);
    await expect(confirm()).rejects.toThrow('no existe');
    await db.exec('reset role; set role anon');
    await expect(candidates()).rejects.toThrow('permission denied');
    await expect(confirm()).rejects.toThrow('permission denied');
  });
  it('no restaura omisiones silenciosamente ni reemplaza un vínculo ya confirmado', async () => {
    await db.query('select public.skip_recurring_occurrence($1,$2)', [rule, '2025-09-19']);
    await expect(confirm()).rejects.toThrow('omitido');
    await db.exec('delete from recurring_occurrences');
    await confirm();
    const otherId = await purchase();
    await expect(confirm({ existing: otherId })).rejects.toThrow('otro movimiento');
  });
});
