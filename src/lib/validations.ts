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

export const transactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE', 'SAVING']),
  amount: z.coerce
    .number({ invalid_type_error: 'Ingresa un monto válido' })
    .positive('El monto debe ser mayor que cero')
    .max(9_999_999_999, 'El monto es demasiado grande'),
  category_id: z.string().uuid('Selecciona una categoría').nullable(),
  credit_card_id: z.string().uuid().nullable().optional(),
  savings_account_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(200, 'Máximo 200 caracteres').optional(),
  transaction_date: dateStringSchema,
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
export const budgetSchema = z.object({
  category_id: z.string().uuid('Selecciona una categoría'),
  amount: z.coerce
    .number({ invalid_type_error: 'Ingresa un monto válido' })
    .positive('El monto debe ser mayor que cero')
    .max(9_999_999_999, 'El monto es demasiado grande'),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
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

export const creditCardSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(40, 'Máximo 40 caracteres'),
  bank: z.string().trim().max(40, 'Máximo 40 caracteres').optional(),
  currency: z.enum(['HNL', 'USD']),
  opening_balance: z.coerce
    .number({ invalid_type_error: 'Ingresa un saldo válido' })
    .min(0, 'No puede ser negativo')
    .max(999_999_999, 'Demasiado grande'),
  credit_limit: optionalPositive,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido'),
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
export type SavingsAccountInput = z.infer<typeof savingsAccountSchema>;
