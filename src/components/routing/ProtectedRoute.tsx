import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/auth';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { ROUTES } from '@/constants/routes';

/** Permite el acceso solo si hay sesión activa. */
export function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) return <FullPageSpinner />;
  if (!session) return <Navigate to={ROUTES.login} replace />;
  return <Outlet />;
}
