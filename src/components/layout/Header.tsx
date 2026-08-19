import { Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface HeaderProps {
  onOpenMenu: () => void;
  userName: string;
}

export function Header({ onOpenMenu, userName }: HeaderProps) {
  const initial = userName.trim().charAt(0).toUpperCase() || 'U';
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Abrir menú"
        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius)] text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden text-sm text-muted-foreground sm:block">
        Hola, <span className="font-medium text-foreground">{userName || 'usuario'}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          aria-hidden
        >
          {initial}
        </span>
      </div>
    </header>
  );
}
