import { describe, expect, it } from 'vitest';
import {
  budgetSchema,
  cardChargeSchema,
  creditCardSchema,
  loginSchema,
  loanSchema,
  receivableCreateSchema,
  receivableMovementSchema,
  recurringTransactionSchema,
  registerSchema,
  transactionSchema,
} from '@/lib/validations';

describe('recurringTransactionSchema', () => {
  const base = {
    name: 'Spotify',
    type: 'EXPENSE' as const,
    amount: 12,
    currency: 'USD' as const,
    category_id: '11111111-1111-1111-1111-111111111111',
    savings_account_id: null,
    credit_card_id: '22222222-2222-2222-2222-222222222222',
    day_of_month: 15,
    start_date: '2026-09-01',
    end_date: '',
    is_active: true,
  };

  it('acepta un gasto mensual cargado a tarjeta', () => {
    expect(recurringTransactionSchema.safeParse(base).success).toBe(true);
  });

  it('exige exactamente una cuenta o tarjeta para un gasto', () => {
    expect(
      recurringTransactionSchema.safeParse({
        ...base,
        savings_account_id: '33333333-3333-3333-3333-333333333333',
      }).success,
    ).toBe(false);
    expect(
      recurringTransactionSchema.safeParse({
        ...base,
        credit_card_id: null,
      }).success,
    ).toBe(false);
  });

  it('permite un ingreso depositado en una cuenta', () => {
    expect(
      recurringTransactionSchema.safeParse({
        ...base,
        name: 'Salario',
        type: 'INCOME',
        currency: 'HNL',
        savings_account_id: '33333333-3333-3333-3333-333333333333',
        credit_card_id: null,
      }).success,
    ).toBe(true);
  });

  it('no permite vincular una cuenta HNL a un movimiento en USD', () => {
    expect(
      recurringTransactionSchema.safeParse({
        ...base,
        currency: 'USD',
        credit_card_id: null,
        savings_account_id: '33333333-3333-3333-3333-333333333333',
      }).success,
    ).toBe(false);
  });

  it('rechaza una fecha final anterior al inicio', () => {
    expect(recurringTransactionSchema.safeParse({ ...base, end_date: '2026-08-31' }).success).toBe(
      false,
    );
  });
});

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

  it('acepta un presupuesto de categoría en dólares', () => {
    expect(budgetSchema.safeParse({ ...base, currency: 'USD' }).success).toBe(true);
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

  it('mantiene la meta de ahorro en lempiras', () => {
    const result = budgetSchema.safeParse({
      ...base,
      kind: 'SAVINGS',
      category_id: null,
      currency: 'USD',
    });
    expect(result.success).toBe(false);
  });
});

describe('cardChargeSchema', () => {
  it('acepta una compra sin pedir un equivalente en lempiras', () => {
    expect(
      cardChargeSchema.safeParse({
        amount: 20,
        category_id: '11111111-1111-1111-1111-111111111111',
        description: 'Spotify',
        charge_date: '2026-09-10',
      }).success,
    ).toBe(true);
  });
});

describe('fechas del calendario financiero', () => {
  it('acepta días mensuales válidos y opcionales en préstamos', () => {
    const loan = {
      name: 'Préstamo personal',
      loan_number: '',
      original_amount: 10000,
      interest_rate: 12,
      term_months: 12,
      installment: 900,
      payment_day: 15,
      current_balance: 10000,
      extra_payment: '',
      start_date: '2026-09-01',
      end_date: '',
      category_id: null,
    };

    expect(loanSchema.safeParse(loan).success).toBe(true);
    expect(loanSchema.safeParse({ ...loan, payment_day: '' }).success).toBe(true);
    expect(loanSchema.safeParse({ ...loan, payment_day: 32 }).success).toBe(false);
  });

  it('valida el día límite de una tarjeta', () => {
    const card = {
      name: 'Kash',
      bank: '',
      opening_balance: 0,
      opening_balance_usd: 0,
      credit_limit: '',
      credit_limit_usd: '',
      payment_due_day: 28,
      color: '#8b5cf6',
    };

    expect(creditCardSchema.safeParse(card).success).toBe(true);
    expect(creditCardSchema.safeParse({ ...card, payment_due_day: 0 }).success).toBe(false);
  });
});

describe('receivables schemas', () => {
  const movement = {
    amount: 500,
    account_id: '11111111-1111-1111-1111-111111111111',
    movement_date: '2026-09-04',
    description: 'Préstamo personal',
  };

  it('acepta un préstamo inicial con persona y cuenta', () => {
    expect(
      receivableCreateSchema.safeParse({
        name: 'Carlos',
        relationship: 'FRIEND',
        phone: '',
        notes: '',
        initial_amount: 1200,
        account_id: movement.account_id,
        movement_date: movement.movement_date,
        description: movement.description,
      }).success,
    ).toBe(true);
  });

  it('rechaza un pago sin cuenta de depósito', () => {
    expect(receivableMovementSchema.safeParse({ ...movement, account_id: '' }).success).toBe(false);
  });
});
