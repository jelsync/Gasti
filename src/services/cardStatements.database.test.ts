// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CardStatementPreview } from '@/services/cardStatements.service';

const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const card = '33333333-3333-4333-8333-333333333333';
const otherCard = '44444444-4444-4444-8444-444444444444';
const auxiliary = [
  'categories',
  'transactions',
  'receivable_people',
  'budgets',
  'loans',
  'recurring_transactions',
  'recurring_occurrences',
  'account_reconciliations',
  'month_closures',
  'financial_goals',
  'financial_goal_movements',
  'savings_accounts',
];
let db: PGlite;

async function preview(date = '2024-09-09', cardId = card) {
  return (
    await db.query<{ result: CardStatementPreview }>(
      'select public.preview_card_statement($1, $2::date) as result',
      [cardId, date],
    )
  ).rows[0].result;
}
async function confirm(snapshot: CardStatementPreview) {
  return (
    await db.query<{ id: string; balance_hnl: string }>(
      'select * from public.confirm_card_statement($1, $2::date, $3::jsonb)',
      [snapshot.card_id, snapshot.statement_date, JSON.stringify(snapshot)],
    )
  ).rows[0];
}
async function charge(date: string, amount: number, currency = 'HNL') {
  await db.query(
    'insert into card_charges (id,user_id,card_id,amount,currency,charge_date) values (gen_random_uuid(),$1,$2,$3,$4,$5)',
    [user, card, amount, currency, date],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    insert into auth.users values ('${user}'), ('${other}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table credit_cards (id uuid primary key, user_id uuid not null, opening_balance numeric(14,2) not null default 0, opening_balance_usd numeric(14,2) not null default 0);
    create table card_charges (id uuid primary key, user_id uuid not null, card_id uuid references credit_cards(id), amount numeric(14,2), currency text, charge_date date);
    create table card_payments (id uuid primary key, user_id uuid not null, card_id uuid references credit_cards(id), amount numeric(14,2), currency text, payment_date date);
    create table profiles (id uuid primary key);
    ${auxiliary.map((table) => `create table ${table} (id uuid primary key, user_id uuid not null);`).join('\n')}
    ${['credit_cards', 'card_charges', 'card_payments', ...auxiliary].map((table) => `alter table ${table} enable row level security; create policy own_rows on ${table} to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());`).join('\n')}
    alter table profiles enable row level security; create policy own_rows on profiles to authenticated using (id = auth.uid());
    grant usage on schema public, auth to authenticated, anon;
    grant all on all tables in schema public to authenticated;
  `);
  await db.exec(readFileSync('supabase/migrations/0024_card_statements.sql', 'utf8'));
}, 60000);

beforeEach(async () => {
  await db.exec(`reset role; truncate card_statements,card_charges,card_payments,credit_cards cascade;
    insert into credit_cards (id,user_id,opening_balance,opening_balance_usd,statement_day)
      values ('${card}','${user}',100,10,9), ('${otherCard}','${other}',999,999,9);
    set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`);
});
afterAll(async () => {
  await db?.close();
});

describe('Cortes manuales con PostgreSQL y RLS', () => {
  it('incluye el día de corte, separa monedas y saldo anterior sin mover dinero', async () => {
    await charge('2024-08-09', 20);
    await charge('2024-08-10', 30);
    await charge('2024-09-09', 11.49, 'USD');
    await charge('2024-09-10', 500);
    await db.exec(
      `insert into card_payments values (gen_random_uuid(),'${user}','${card}',5,'USD','2024-09-09');`,
    );
    const snapshot = await preview();
    expect(snapshot).toMatchObject({
      period_start: '2024-08-10',
      opening_hnl: 120,
      opening_usd: 10,
      charges_hnl: 30,
      charges_usd: 11.49,
      payments_hnl: 0,
      payments_usd: 5,
      balance_hnl: 150,
      balance_usd: 16.49,
    });
    expect((await db.query('select * from card_statements')).rows).toHaveLength(0);
    await confirm(snapshot);
    expect((await db.query('select * from card_charges')).rows).toHaveLength(4);
    expect((await db.query('select * from card_payments')).rows).toHaveLength(1);
    expect((await db.query('select * from transactions')).rows).toHaveLength(0);
    expect((await db.query('select * from budgets')).rows).toHaveLength(0);
  });

  it('actualiza el mismo corte con compras tardías y rechaza una revisión desactualizada', async () => {
    const first = await confirm(await preview());
    const stale = await preview();
    await charge('2024-09-09', 50);
    await expect(confirm(stale)).rejects.toThrow('Los importes cambiaron');
    expect((await db.query('select balance_hnl from card_statements')).rows[0]).toEqual({
      balance_hnl: '100.00',
    });
    const updated = await confirm(await preview());
    expect(updated.id).toBe(first.id);
    expect(updated.balance_hnl).toBe('150.00');
    expect((await db.query('select * from card_statements')).rows).toHaveLength(1);
    // Registrar después del corte sigue permitido y no altera la fotografía guardada.
    await charge('2024-09-10', 90);
    expect((await preview()).balance_hnl).toBe(150);
  });

  it('ajusta meses cortos y conserva ciclos históricos al cambiar la configuración', async () => {
    await db.exec(`update credit_cards set statement_day = 31 where id = '${card}'`);
    expect(await preview('2024-02-29')).toMatchObject({
      period_start: '2024-02-01',
      statement_day: 31,
    });
    expect(await preview('2023-02-28')).toMatchObject({
      period_start: '2023-02-01',
      statement_day: 31,
    });
    expect(await preview('2024-03-31')).toMatchObject({ period_start: '2024-03-01' });
    await confirm(await preview('2024-02-29'));
    await db.exec(`update credit_cards set statement_day = 20 where id = '${card}'`);
    expect(await preview('2024-02-29')).toMatchObject({
      period_start: '2024-02-01',
      statement_day: 31,
    });
    expect(await preview('2024-03-20')).toMatchObject({
      period_start: '2024-02-21',
      statement_day: 20,
    });
    await expect(preview('2024-03-19')).rejects.toThrow('no corresponde');
  });

  it('requiere configurar el día, bloquea confirmaciones futuras y rechaza acceso ajeno', async () => {
    await expect(preview('2024-09-09', otherCard)).rejects.toThrow('La tarjeta no existe');
    const future = await preview('2099-09-09');
    await expect(confirm(future)).rejects.toThrow('a partir de su fecha');
    await db.exec(`update credit_cards set statement_day = null where id = '${card}'`);
    await expect(preview()).rejects.toThrow('Configura primero');
    await db.exec('reset role; set role anon;');
    await expect(preview()).rejects.toThrow('permission denied');
  });

  it('el respaldo incluye cortes propios y RLS impide consultar o cambiar los de otra persona', async () => {
    const saved = await confirm(await preview());
    await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`);
    expect((await db.query('select * from card_statements')).rows).toHaveLength(0);
    expect(
      (
        await db.query('update card_statements set balance_hnl=0 where id=$1 returning id', [
          saved.id,
        ])
      ).rows,
    ).toHaveLength(0);
    const backup = (
      await db.query<{ result: { tables: Record<string, unknown[]> } }>(
        'select export_user_backup() as result',
      )
    ).rows[0].result;
    expect(Object.keys(backup.tables)).toHaveLength(17);
    expect(backup.tables.card_statements).toHaveLength(0);
    await db.exec(`select set_config('request.jwt.claim.sub','${user}',false)`);
    const ownBackup = (
      await db.query<{ result: { tables: { card_statements: unknown[] } } }>(
        'select export_user_backup() as result',
      )
    ).rows[0].result;
    expect(ownBackup.tables.card_statements).toHaveLength(1);
  });
});
