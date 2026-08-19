import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/routing/ProtectedRoute';
import { PublicRoute } from '@/components/routing/PublicRoute';
import { AppLayout } from '@/layouts/AppLayout';
import { Spinner } from '@/components/ui/Spinner';
import { ROUTES } from '@/constants/routes';

import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import UpdatePasswordPage from '@/pages/auth/UpdatePasswordPage';

import DashboardPage from '@/pages/DashboardPage';
import TransactionsPage from '@/pages/TransactionsPage';
import BudgetsPage from '@/pages/BudgetsPage';
import HistoryPage from '@/pages/HistoryPage';
import CategoriesPage from '@/pages/CategoriesPage';
import SettingsPage from '@/pages/SettingsPage';
import NotFoundPage from '@/pages/NotFoundPage';

// Cargada de forma diferida: contiene la librería de gráficos (Recharts).
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));

export default function App() {
  return (
    <Routes>
      {/* Rutas públicas (invitado) */}
      <Route element={<PublicRoute />}>
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.register} element={<RegisterPage />} />
        <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
      </Route>

      {/* Actualizar contraseña: accesible con la sesión de recuperación */}
      <Route path={ROUTES.updatePassword} element={<UpdatePasswordPage />} />

      {/* Rutas privadas */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path={ROUTES.dashboard} element={<DashboardPage />} />
          <Route path={ROUTES.transactions} element={<TransactionsPage />} />
          <Route path={ROUTES.budgets} element={<BudgetsPage />} />
          <Route path={ROUTES.history} element={<HistoryPage />} />
          <Route
            path={ROUTES.reports}
            element={
              <Suspense
                fallback={
                  <div className="flex justify-center py-16">
                    <Spinner />
                  </div>
                }
              >
                <ReportsPage />
              </Suspense>
            }
          />
          <Route path={ROUTES.categories} element={<CategoriesPage />} />
          <Route path={ROUTES.settings} element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
