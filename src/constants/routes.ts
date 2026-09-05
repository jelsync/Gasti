export const ROUTES = {
  // Públicas
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  updatePassword: '/update-password',
  // Privadas
  dashboard: '/',
  transactions: '/transacciones',
  budgets: '/presupuestos',
  loans: '/prestamos',
  cards: '/tarjetas',
  savings: '/ahorro',
  receivables: '/personas-que-me-deben',
  history: '/historial',
  reports: '/reportes',
  categories: '/categorias',
  settings: '/ajustes',
} as const;
