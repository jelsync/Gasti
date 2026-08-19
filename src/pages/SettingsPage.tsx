import { useNavigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/auth';
import { useTheme } from '@/contexts/theme';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const name = (user?.user_metadata?.name as string | undefined) ?? '—';
  const email = user?.email ?? '—';

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cerrar sesión');
    }
  };

  return (
    <>
      <PageHeader title="Ajustes" description="Tu cuenta y preferencias" />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cuenta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Nombre</span>
              <span className="font-medium">{name}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Correo</span>
              <span className="font-medium">{email}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Apariencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {(['light', 'dark'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-[var(--radius)] border p-3 text-sm font-medium transition-colors',
                    theme === value
                      ? 'border-primary bg-accent text-accent-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  {value === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {value === 'light' ? 'Claro' : 'Oscuro'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Seguridad</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Cambia tu contraseña de acceso.</p>
            <Button variant="outline" onClick={() => navigate(ROUTES.updatePassword)}>
              Cambiar contraseña
            </Button>
          </CardContent>
        </Card>

        <div>
          <Button variant="danger" onClick={handleSignOut}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </>
  );
}
