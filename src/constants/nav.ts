import {
  BarChart3,
  BookCheck,
  CalendarDays,
  CalendarClock,
  CreditCard,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
  Tags,
  Target,
  Wallet,
  Users,
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
  { label: 'Calendario', to: ROUTES.financialCalendar, icon: CalendarDays },
  { label: 'Metas', to: ROUTES.financialGoals, icon: Target },
  { label: 'Presupuestos', to: ROUTES.budgets, icon: PiggyBank },
  { label: 'Préstamos', to: ROUTES.loans, icon: Landmark },
  { label: 'Tarjetas', to: ROUTES.cards, icon: CreditCard },
  { label: 'Cuentas', to: ROUTES.savings, icon: Wallet },
  { label: 'Cierre mensual', to: ROUTES.reconciliation, icon: BookCheck },
  { label: 'Por cobrar', to: ROUTES.receivables, icon: Users },
  { label: 'Historial', to: ROUTES.history, icon: CalendarClock },
  { label: 'Reportes', to: ROUTES.reports, icon: BarChart3 },
  { label: 'Categorías', to: ROUTES.categories, icon: Tags },
  { label: 'Ajustes', to: ROUTES.settings, icon: Settings },
];
