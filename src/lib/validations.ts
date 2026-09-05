import { z } from 'zod';

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------
export const emailSchema = z
  .string()
  .min(1, 'El correo es obligatorio')
  .email('Correo electrónico inválido');

const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña es demasiado larga');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Ingresa tu nombre'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

// ---------------------------------------------------------------------------
// Transacciones
// ---------------------------------------------------------------------------
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Fecha inválida');

export const transactionSchema = z
  .object({
    type: z.enum(['INCOME', 'EXPENSE', 'SAVING', 'TRANSFER']),
    amount: z.coerce
      .number({ invalid_type_error: 'Ingresa un monto válido' })
      .positive('El monto debe ser mayor que cero')
      .max(9_999_999_999, 'El monto es demasiado grande'),
    category_id: z.string().uuid('Selecciona una categoría').nullable(),
    credit_card_id: z.string().uuid().nullable().optional(),
    savings_account_id: z.string().uuid().nullable().optional(),
    destination_savings_account_id: z.string().uuid().nullable().optional(),
    receivable_person_id: z.string().uuid().nullable().optional(),
    receivable_movement_kind: z.enum(['LEND', 'REPAYMENT']).nullable().optional(),
    loan_id: z.string().uuid().nullable().optional(),
    loan_payment_kind: z.enum(['INSTALLMENT', 'EXTRA']).nullable().optional(),
    loan_principal_amount: z.number().min(0).nullable().optional(),
    loan_interest_amount: z.number().min(0).nullable().optional(),
    loan_balance_after: z.number().min(0).nullable().optional(),
    description: z.string().trim().max(200, 'Máximo 200 caracteres').optional(),
    transaction_date: dateStringSchema,
  })
  .superRefine((transaction, context) => {
    if (transaction.type === 'EXPENSE' && !transaction.savings_account_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['savings_account_id'],
        message: 'Selecciona la cuenta de donde se debitará el gasto',
      });
    }
    if (transaction.type === 'TRANSFER') {
      if (!transaction.savings_account_id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Selecciona la cuenta de origen',
          path: ['savings_account_id'],
        });
      }
      if (!transaction.destination_savings_account_id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Selecciona la cuenta de destino',
          path: ['destination_savings_account_id'],
        });
      } else if (transaction.destination_savings_account_id === transaction.savings_account_id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La cuenta destino debe ser diferente',
          path: ['destination_savings_account_id'],
        });
      }
    }
  });

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------
export const categorySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(40, 'Máximo 40 caracteres'),
  type: z.enum(['INCOME', 'EXPENSE']),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido'),
});

// ---------------------------------------------------------------------------
// Presupuestos
// ---------------------------------------------------------------------------
export const budgetSchema = z
  .object({
    kind: z.enum(['CATEGORY', 'SAVINGS']),
    category_id: z.string().uuid('Selecciona una categoría').nullable(),
    amount: z.coerce
      .number({ invalid_type_error: 'Ingresa un monto válido' })
      .positive('El monto debe ser mayor que cero')
      .max(9_999_999_999, 'El monto es demasiado grande'),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000).max(2100),
  })
  .refine((d) => (d.kind === 'CATEGORY' ? !!d.category_id : d.category_id === null), {
    message: 'Selecciona una categoría',
    path: ['category_id'],
  });

// ---------------------------------------------------------------------------
// Préstamos
// ---------------------------------------------------------------------------
const optionalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Fecha inválida')
  .optional()
  .or(z.literal(''));

export const loanSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(60, 'Máximo 60 caracteres'),
  loan_number: z.string().trim().max(40, 'Máximo 40 caracteres').optional(),
  original_amount: z.coerce
    .number({ invalid_type_error: 'Ingresa un monto válido' })
    .positive('El monto debe ser mayor que cero')
    .max(999_999_999, 'El monto es demasiado grande'),
  interest_rate: z.coerce
    .number({ invalid_type_error: 'Ingresa una tasa válida' })
    .min(0, 'La tasa no puede ser negativa')
    .max(100, 'Tasa inválida'),
  term_months: z.coerce
    .number({ invalid_type_error: 'Ingresa un plazo válido' })
    .int('Debe ser un número entero')
    .min(1, 'Mínimo 1 mes')
    .max(1200, 'Plazo demasiado largo'),
  installment: z.coerce
    .number({ invalid_type_error: 'Ingresa una cuota válida' })
    .positive('La cuota debe ser mayor que cero')
    .max(999_999_999, 'La cuota es demasiado grande'),
  current_balance: z.coerce
    .number({ invalid_type_error: 'Ingresa un saldo válido' })
    .min(0, 'El saldo no puede ser negativo')
    .max(999_999_999, 'El saldo es demasiado grande'),
  extra_payment: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce
      .number({ invalid_type_error: 'Monto inválido' })
      .positive('Debe ser mayor que cero')
      .max(999_999_999, 'Monto demasiado grande')
      .optional(),
  ),
  start_date: dateStringSchema,
  end_date: optionalDateSchema,
  category_id: z.string().uuid('Selecciona una categoría').nullable(),
});

// ---------------------------------------------------------------------------
// Tarjetas de crédito y ahorro
// ---------------------------------------------------------------------------
const optionalPositive = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce
    .number({ invalid_type_error: 'Monto inválido' })
    .positive('Debe ser mayor que cero')
    .max(999_999_999, 'Monto demasiado grande')
    .optional(),
);

const nonNegativeAmount = z.coerce
  .number({ invalid_type_error: 'Ingresa un monto válido' })
  .min(0, 'No puede ser negativo')
  .max(999_999_999, 'Demasiado grande');

export const creditCardSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(40, 'Máximo 40 caracteres'),
  bank: z.string().trim().max(40, 'Máximo 40 caracteres').optional(),
  opening_balance: nonNegativeAmount, // deuda en Lempiras
  opening_balance_usd: nonNegativeAmount, // deuda en Dólares
  credit_limit: optionalPositive, // límite en Lempiras
  credit_limit_usd: optionalPositive, // límite en Dólares
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido'),
});

export const cardChargeSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Ingresa un monto válido' })
    .positive('El monto debe ser mayor que cero')
    .max(999_999_999, 'Demasiado grande'),
  description: z.string().trim().max(200, 'Máximo 200 caracteres').optional(),
  amount_hnl: optionalPositive,
  category_id: z.string().uuid('Selecciona una categoría'),
  charge_date: dateStringSchema,
});

export const cardPaymentSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Ingresa un monto válido' })
    .positive('El monto debe ser mayor que cero')
    .max(999_999_999, 'Demasiado grande'),
  payment_date: dateStringSchema,
});

export const savingsAccountSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(40, 'Máximo 40 caracteres'),
  institution: z.string().trim().max(40, 'Máximo 40 caracteres').optional(),
  opening_balance: z.coerce
    .number({ invalid_type_error: 'Ingresa un saldo válido' })
    .min(0, 'No puede ser negativo')
    .max(999_999_999, 'Demasiado grande'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido'),
});

export const receivablePersonSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80, 'Máximo 80 caracteres'),
  relationship: z.enum(['FAMILY', 'FRIEND', 'OTHER']),
  phone: z.string().trim().max(30, 'Máximo 30 caracteres').optional(),
  notes: z.string().trim().max(300, 'Máximo 300 caracteres').optional(),
});

export const receivableMovementSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Ingresa un monto válido' })
    .positive('El monto debe ser mayor que cero')
    .max(999_999_999, 'El monto es demasiado grande'),
  account_id: z.string().uuid('Selecciona una cuenta'),
  movement_date: dateStringSchema,
  description: z.string().trim().max(200, 'Máximo 200 caracteres').optional(),
});

export const receivableCreateSchema = receivablePersonSchema.merge(
  receivableMovementSchema
    .extend({
      initial_amount: z.coerce
        .number({ invalid_type_error: 'Ingresa un monto válido' })
        .positive('El monto debe ser mayor que cero')
        .max(999_999_999, 'El monto es demasiado grande'),
    })
    .omit({ amount: true }),
);

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
export type LoanInput = z.infer<typeof loanSchema>;
export type CreditCardInput = z.infer<typeof creditCardSchema>;
export type CardPaymentInput = z.infer<typeof cardPaymentSchema>;
export type CardChargeInput = z.infer<typeof cardChargeSchema>;
export type SavingsAccountInput = z.infer<typeof savingsAccountSchema>;
export type ReceivablePersonInput = z.infer<typeof receivablePersonSchema>;
export type ReceivableMovementInput = z.infer<typeof receivableMovementSchema>;
export type ReceivableCreateInput = z.infer<typeof receivableCreateSchema>;
