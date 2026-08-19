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
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.coerce
    .number({ invalid_type_error: 'Ingresa un monto válido' })
    .positive('El monto debe ser mayor que cero')
    .max(9_999_999_999, 'El monto es demasiado grande'),
  category_id: z.string().uuid('Selecciona una categoría').nullable(),
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

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
