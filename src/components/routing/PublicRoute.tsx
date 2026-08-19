import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/auth';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { ROUTES } from '@/constants/routes';

/** Rutas de invitado: si ya hay sesión, redirige al dashboard. */
export function PublicRoute() {
  const { session, loading } = useAuth();

  if (loading) return <FullPageSpinner />;
  if (session) return <Navigate to={ROUTES.dashboard} replace />;
  return <Outlet />;
}
