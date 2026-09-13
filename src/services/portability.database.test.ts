// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const account = '33333333-3333-4333-8333-333333333333';
const category = '44444444-4444-4444-8444-444444444444';
const expense = '55555555-5555-4555-8555-555555555555';
const otherAccount = '66666666-6666-4666-8666-666666666666';
const otherCategory = '77777777-7777-4777-8777-777777777777';
const auxiliary = [
  'profiles',
  'receivable_people',
  'budgets',
  'loans',
  'credit_cards',
  'card_payments',
  'card_charges',
  'recurring_transactions',
  'recurring_occurrences',
  'account_reconciliations',
  'month_closures',
  'financial_goals',
  'financial_goal_movements',
];
let db: PGlite;
const entry = (overrides = {}) => ({
  id: crypto.randomUUID(),
  type: 'INCOME',
  amount: 100,
  transaction_date: '2026-09-01',
  category_id: category,
  description: 'Ingreso bancario',
  allow_duplicate: false,
  ...overrides,
});
const importRows = (rows: ReturnType<typeof entry>[], target = account) =>
  db.query<{ result: { inserted: number; skipped: number } }>(
    'select public.import_bank_transactions($1, $2::jsonb) as result',
    [target, JSON.stringify(rows)],
  );

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create type public.transaction_type as enum ('INCOME','EXPENSE','SAVING','TRANSFER');
    create table savings_accounts (id uuid primary key, user_id uuid not null, name text);
    create table categories (id uuid primary key, user_id uuid not null, type public.transaction_type);
    create table transactions (id uuid primary key, user_id uuid not null, savings_account_id uuid references savings_accounts(id), destination_savings_account_id uuid, category_id uuid references categories(id), type public.transaction_type, amount numeric(14,2), currency text, transaction_date date, description text);
    ${auxiliary.map((table) => `create table ${table} (id uuid primary key${table === 'profiles' ? '' : ', user_id uuid not null'});`).join('\n')}
    ${['savings_accounts', 'categories', 'transactions', ...auxiliary].map((table) => `alter table ${table} enable row level security; create policy own_rows on ${table} to authenticated using (${table === 'profiles' ? 'id' : 'user_id'} = auth.uid()) with check (${table === 'profiles' ? 'id' : 'user_id'} = auth.uid());`).join('\n')}
    grant usage on schema public, auth to authenticated, anon;
    grant all on all tables in schema public to authenticated;
    insert into savings_accounts values ('${account}', '${user}', 'Cuenta propia'), ('${otherAccount}', '${other}', 'Otra cuenta');
    insert into categories values ('${category}', '${user}', 'INCOME'), ('${expense}', '${user}', 'EXPENSE'), ('${otherCategory}', '${other}', 'INCOME');
    insert into profiles values ('${user}'), ('${other}');
  `);
  await db.exec(readFileSync('supabase/migrations/0022_portability.sql', 'utf8'));
}, 60000);

beforeEach(async () => {
  await db.exec(
    `reset role; truncate transactions; set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`,
  );
});
afterAll(async () => {
  await db?.close();
});

describe('RPC de portabilidad con PostgreSQL y RLS', () => {
  it('importa un lote y omite reintentos incluso si se autorizó duplicar', async () => {
    const row = entry({ allow_duplicate: true });
    expect((await importRows([row])).rows[0].result).toEqual({ inserted: 1, skipped: 0 });
    expect((await importRows([row])).rows[0].result).toEqual({ inserted: 0, skipped: 1 });
  });
  it('detecta duplicados dentro del lote, en la cuenta y autoriza excepciones explícitas', async () => {
    expect((await importRows([entry(), entry()])).rows[0].result).toEqual({
      inserted: 1,
      skipped: 1,
    });
    expect((await importRows([entry()])).rows[0].result.inserted).toBe(0);
    expect((await importRows([entry({ allow_duplicate: true })])).rows[0].result.inserted).toBe(1);
  });
  it('reconoce una transferencia como débito existente sin crear un segundo gasto', async () => {
    await db.query(
      "insert into transactions (id,user_id,savings_account_id,type,amount,currency,transaction_date) values ($1,$2,$3,'TRANSFER',100,'HNL','2026-09-01')",
      [crypto.randomUUID(), user, account],
    );
    expect(
      (await importRows([entry({ type: 'EXPENSE', category_id: expense })])).rows[0].result,
    ).toEqual({ inserted: 0, skipped: 1 });
  });
  it('revierte todo el lote cuando una fila falla', async () => {
    await expect(importRows([entry(), entry({ amount: -10 })])).rejects.toThrow(
      'Movimiento inválido',
    );
    expect((await db.query('select * from transactions')).rows).toHaveLength(0);
  });
  it('rechaza categorías de otro tipo, de otro usuario y cuentas ajenas', async () => {
    await expect(importRows([entry({ category_id: expense })])).rejects.toThrow('categoría');
    await expect(importRows([entry({ category_id: otherCategory })])).rejects.toThrow('categoría');
    await expect(importRows([entry()], otherAccount)).rejects.toThrow('cuenta');
  });
  it('rechaza fechas imposibles, montos sin centavos exactos y transferencias bancarias genéricas', async () => {
    await expect(importRows([entry({ transaction_date: '2026-02-30' })])).rejects.toThrow();
    await expect(importRows([entry({ amount: 1.001 })])).rejects.toThrow('Movimiento inválido');
    await expect(importRows([entry({ type: 'TRANSFER' })])).rejects.toThrow('Movimiento inválido');
  });
  it('respalda todas las tablas y más de 1000 filas sin incluir otro usuario', async () => {
    await db.exec(
      `reset role; insert into transactions (id,user_id,type,amount,currency,transaction_date) select gen_random_uuid(), '${user}', 'INCOME', 1, 'HNL', '2026-09-01' from generate_series(1,1005); insert into transactions (id,user_id) values (gen_random_uuid(), '${other}'); set role authenticated;`,
    );
    const result = await db.query<{
      backup: { tables: Record<string, { id: string; user_id?: string }[]> };
    }>('select public.export_user_backup() as backup');
    expect(Object.keys(result.rows[0].backup.tables)).toHaveLength(16);
    expect(result.rows[0].backup.tables.transactions).toHaveLength(1005);
    expect(result.rows[0].backup.tables.profiles).toEqual([{ id: user }]);
    expect(result.rows[0].backup.tables.savings_accounts).toHaveLength(1);
  });
  it('no permite invocar las funciones como anónimo', async () => {
    await db.exec('reset role; set role anon;');
    await expect(db.query('select public.export_user_backup()')).rejects.toThrow(
      'permission denied',
    );
    await expect(importRows([entry()])).rejects.toThrow('permission denied');
  });
});
