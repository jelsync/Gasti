import { describe, expect, it } from 'vitest';
import { budgetSchema, loginSchema, registerSchema, transactionSchema } from '@/lib/validations';

describe('registerSchema', () => {
  const base = {
    name: 'Juan',
    email: 'juan@correo.com',
    password: 'secret123',
    confirmPassword: 'secret123',
  };

  it('acepta datos válidos', () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza contraseñas que no coinciden', () => {
    const result = registerSchema.safeParse({ ...base, confirmPassword: 'otra12345' });
    expect(result.success).toBe(false);
  });

  it('rechaza contraseña corta', () => {
    const result = registerSchema.safeParse({ ...base, password: '123', confirmPassword: '123' });
    expect(result.success).toBe(false);
  });

  it('rechaza correo inválido', () => {
    expect(registerSchema.safeParse({ ...base, email: 'no-es-correo' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requiere correo y contraseña', () => {
    expect(loginSchema.safeParse({ email: '', password: '' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });
});

describe('transactionSchema', () => {
  const base = {
    type: 'EXPENSE' as const,
    amount: 100,
    category_id: null,
    savings_account_id: '11111111-1111-1111-1111-111111111111',
    transaction_date: '2026-08-19',
  };

  it('acepta una transacción válida', () => {
    expect(transactionSchema.safeParse(base).success).toBe(true);
  });

  it('coacciona el monto desde string', () => {
    const result = transactionSchema.safeParse({ ...base, amount: '250.50' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(250.5);
  });

  it('rechaza monto cero o negativo', () => {
    expect(transactionSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...base, amount: -5 }).success).toBe(false);
  });

  it('rechaza fecha inválida', () => {
    expect(transactionSchema.safeParse({ ...base, transaction_date: '19/08/2026' }).success).toBe(
      false,
    );
  });

  it('rechaza category_id que no sea uuid ni null', () => {
    expect(transactionSchema.safeParse({ ...base, category_id: 'abc' }).success).toBe(false);
  });

  it('requiere una cuenta para gastos normales', () => {
    expect(transactionSchema.safeParse({ ...base, savings_account_id: null }).success).toBe(false);
  });

  it('acepta transferencias entre dos cuentas diferentes', () => {
    const result = transactionSchema.safeParse({
      ...base,
      type: 'TRANSFER',
      category_id: null,
      destination_savings_account_id: '22222222-2222-2222-2222-222222222222',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza transferencias hacia la misma cuenta', () => {
    const result = transactionSchema.safeParse({
      ...base,
      type: 'TRANSFER',
      category_id: null,
      destination_savings_account_id: base.savings_account_id,
    });
    expect(result.success).toBe(false);
  });
});

describe('budgetSchema', () => {
  const base = {
    kind: 'CATEGORY' as const,
    category_id: '11111111-1111-1111-1111-111111111111',
    amount: 5000,
    month: 8,
    year: 2026,
  };

  it('acepta un presupuesto de categoría válido', () => {
    expect(budgetSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza mes fuera de rango', () => {
    expect(budgetSchema.safeParse({ ...base, month: 13 }).success).toBe(false);
  });

  it('rechaza categoría sin seleccionar cuando es de categoría', () => {
    expect(budgetSchema.safeParse({ ...base, category_id: null }).success).toBe(false);
  });

  it('acepta una meta de ahorro (sin categoría)', () => {
    const result = budgetSchema.safeParse({ ...base, kind: 'SAVINGS', category_id: null });
    expect(result.success).toBe(true);
  });
});
