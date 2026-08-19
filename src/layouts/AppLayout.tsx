import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/auth';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userName = (user?.user_metadata?.name as string | undefined) ?? user?.email ?? '';

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cerrar sesión');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar fijo en escritorio */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <Sidebar onSignOut={handleSignOut} />
      </aside>

      {/* Drawer móvil */}
      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            'absolute inset-0 bg-black/50 transition-opacity',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={cn(
            'absolute inset-y-0 left-0 w-64 transition-transform duration-200',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Sidebar onSignOut={handleSignOut} onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>

      {/* Contenido */}
      <div className="lg:pl-64">
        <Header onOpenMenu={() => setMobileOpen(true)} userName={userName} />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
