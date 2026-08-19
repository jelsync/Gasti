import {
  BarChart3,
  CalendarClock,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
  Tags,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES } from '@/constants/routes';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: ROUTES.dashboard, icon: LayoutDashboard, end: true },
  { label: 'Transacciones', to: ROUTES.transactions, icon: Receipt },
  { label: 'Presupuestos', to: ROUTES.budgets, icon: PiggyBank },
  { label: 'Historial', to: ROUTES.history, icon: CalendarClock },
  { label: 'Reportes', to: ROUTES.reports, icon: BarChart3 },
  { label: 'Categorías', to: ROUTES.categories, icon: Tags },
  { label: 'Ajustes', to: ROUTES.settings, icon: Settings },
];
