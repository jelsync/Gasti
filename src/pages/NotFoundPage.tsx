import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/Logo';
import { ROUTES } from '@/constants/routes';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <Logo size="lg" />
      <p className="text-5xl font-bold text-primary">404</p>
      <p className="text-muted-foreground">La página que buscas no existe.</p>
      <Link to={ROUTES.dashboard}>
        <Button>Volver al inicio</Button>
      </Link>
    </div>
  );
}
