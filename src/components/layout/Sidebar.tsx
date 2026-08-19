import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { NAV_ITEMS } from '@/constants/nav';
import { cn } from '@/lib/utils';

interface SidebarProps {
  onNavigate?: () => void;
  onSignOut: () => void;
}

export function Sidebar({ onNavigate, onSignOut }: SidebarProps) {
  return (
    <div className="flex h-full flex-col gap-2 border-r border-border bg-card">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" aria-hidden />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-expense-soft hover:text-expense"
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
