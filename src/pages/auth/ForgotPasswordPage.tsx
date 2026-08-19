import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from '@/layouts/AuthLayout';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/auth';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validations';
import { ROUTES } from '@/constants/routes';

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (values: ForgotPasswordInput) => {
    try {
      await requestPasswordReset(values.email);
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar el correo');
    }
  };

  return (
    <AuthLayout
      title="Recuperar contraseña"
      subtitle={sent ? undefined : 'Te enviaremos un enlace para restablecerla'}
      footer={
        <Link to={ROUTES.login} className="font-medium text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-income-soft text-income">
            <MailCheck className="h-6 w-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.
            Revisa tu bandeja de entrada y la carpeta de spam.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Correo electrónico" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
          </Field>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Enviar enlace
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
