import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthLayout } from '@/layouts/AuthLayout';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/auth';
import { registerSchema, type RegisterInput } from '@/lib/validations';
import { ROUTES } from '@/constants/routes';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterInput) => {
    try {
      const { needsEmailConfirmation } = await signUp(values.name, values.email, values.password);
      if (needsEmailConfirmation) {
        toast.success('Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.');
        navigate(ROUTES.login, { replace: true });
      } else {
        toast.success('¡Bienvenido a Gasti!');
        navigate(ROUTES.dashboard, { replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la cuenta');
    }
  };

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Empieza a controlar tus finanzas"
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to={ROUTES.login} className="font-medium text-primary hover:underline">
            Iniciar sesión
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Nombre" htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Tu nombre"
            aria-invalid={!!errors.name}
            {...register('name')}
          />
        </Field>

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

        <Field
          label="Contraseña"
          htmlFor="password"
          error={errors.password?.message}
          hint="Mínimo 8 caracteres"
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </Field>

        <Field
          label="Confirmar contraseña"
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={!!errors.confirmPassword}
            {...register('confirmPassword')}
          />
        </Field>

        <Button type="submit" className="w-full" loading={isSubmitting}>
          Crear cuenta
        </Button>
      </form>
    </AuthLayout>
  );
}
