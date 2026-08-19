// Traduce errores de Supabase a mensajes amigables en español.

interface MaybeError {
  message?: string;
  code?: string;
  status?: number;
}

const AUTH_MESSAGES: Record<string, string> = {
  'invalid login credentials': 'Correo o contraseña incorrectos.',
  'email not confirmed': 'Debes confirmar tu correo antes de iniciar sesión.',
  'user already registered': 'Ya existe una cuenta con este correo.',
  'user already exists': 'Ya existe una cuenta con este correo.',
  'password should be at least 6 characters':
    'La contraseña es demasiado corta.',
  'unable to validate email address: invalid format': 'El formato del correo es inválido.',
  'email rate limit exceeded': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  'for security purposes, you can only request this after':
    'Por seguridad, espera unos segundos antes de volver a intentarlo.',
  'new password should be different from the old password':
    'La nueva contraseña debe ser diferente a la anterior.',
};

/** Mensaje amigable para errores de autenticación. */
export function mapAuthError(error: unknown): string {
  const err = error as MaybeError | null;
  const raw = err?.message?.toLowerCase().trim() ?? '';

  for (const [key, message] of Object.entries(AUTH_MESSAGES)) {
    if (raw.includes(key)) return message;
  }

  if (err?.status === 0 || raw.includes('failed to fetch') || raw.includes('network')) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  }

  return err?.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}

/** Mensaje amigable para errores de base de datos / operaciones. */
export function mapDbError(error: unknown, fallback = 'Ocurrió un error. Inténtalo de nuevo.'): string {
  const err = error as MaybeError | null;
  const raw = err?.message?.toLowerCase() ?? '';

  if (err?.code === '23505' || raw.includes('duplicate key')) {
    return 'Ya existe un registro con esos datos.';
  }
  if (raw.includes('failed to fetch') || raw.includes('network')) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  }
  return err?.message || fallback;
}
