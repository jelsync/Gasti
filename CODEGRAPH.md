# Codegraph de Gasti

Última actualización: 2026-09-04.

Este archivo es el índice de navegación del repositorio. Empieza aquí y abre solo los archivos relacionados con la tarea.

## Vista general

```text
Navegador
  main.tsx
    App.tsx (rutas)
      pages/*
        hooks/use*.ts (estado y recarga)
          services/*.service.ts (consultas Supabase)
            lib/supabase.ts
              Supabase Auth + PostgreSQL + RLS
```

- UI compartida: `src/components/ui/`.
- Tipos de base de datos: `src/types/database.types.ts`.
- Modelos enriquecidos para UI: `src/types/models.ts`.
- Validación de formularios: `src/lib/validations.ts`.
- Estilos globales y tokens: `src/index.css`.

## Entrada, rutas y layout

| Responsabilidad | Archivos |
| --- | --- |
| Bootstrap React | `src/main.tsx` |
| Definición de rutas | `src/App.tsx`, `src/constants/routes.ts` |
| Menú lateral | `src/constants/nav.ts`, `src/components/layout/Sidebar.tsx` |
| Layout autenticado | `src/layouts/AppLayout.tsx`, `src/components/layout/Header.tsx` |
| Protección de rutas | `src/components/routing/ProtectedRoute.tsx`, `PublicRoute.tsx` |
| Tema | `src/contexts/ThemeProvider.tsx`, `theme.ts` |

## Autenticación

```text
pages/auth/*
  -> contexts/AuthProvider.tsx + contexts/auth.ts
  -> lib/supabase.ts
  -> Supabase Auth
```

- Login, registro, recuperación y cambio de contraseña viven en `src/pages/auth/`.
- La URL pública de producción también debe estar autorizada en Supabase Authentication → URL Configuration.

## Dominios funcionales

### Dashboard y reportes

- Página: `src/pages/DashboardPage.tsx`.
- Cálculos mensuales: `src/utils/finance.ts`.
- Formato monetario/fechas: `src/utils/format.ts`, `src/utils/date.ts`.
- Reportes: `src/pages/ReportsPage.tsx`, `src/components/reports/Charts.tsx`.
- El dashboard consume transacciones, presupuestos, préstamos, tarjetas y cuentas mediante sus hooks.

### Transacciones e ingresos

```text
TransactionsPage
  -> TransactionForm / MovementList
  -> useTransactions
  -> transactions.service
  -> transactions (Supabase)
```

- Página: `src/pages/TransactionsPage.tsx`.
- Formulario principal: `src/components/transactions/TransactionForm.tsx`.
- Listados: `MovementList.tsx` y `TransactionList.tsx`.
- Hook/servicio: `src/hooks/useTransactions.ts`, `src/services/transactions.service.ts`.
- Categorías fijas de ingreso y orden: `src/constants/incomeCategories.ts`.
- `INCOME` vinculado a una cuenta conserva su tipo, suma al dashboard y aumenta esa cuenta.
- Un gasto normal exige cuenta: conserva `EXPENSE`, suma a gastos y reduce la cuenta elegida.
- `TRANSFER` usa `savings_account_id` como origen y `destination_savings_account_id` como destino; no altera los totales del dashboard.

### Cuentas

```text
SavingsPage
  -> useSavingsAccounts -> savings.service -> savings_accounts
  -> useSavingsAccountMovements -> savings.service -> transactions
```

- Página y listado de movimientos: `src/pages/SavingsPage.tsx`.
- Formulario: `src/components/savings/SavingsAccountForm.tsx`.
- Hooks: `src/hooks/useSavingsAccounts.ts`, `useSavingsAccountMovements.ts`.
- Servicio: `src/services/savings.service.ts`.
- Aunque algunos nombres internos conservan `Savings`, la interfaz se denomina “Cuentas”.
- Saldo = saldo inicial + `INCOME`/`SAVING` − `EXPENSE` con el mismo `savings_account_id`.
- Las transferencias restan a la cuenta origen y suman a la cuenta destino; los pagos de tarjeta solo restan a la cuenta origen.
- Editar una cuenta reemplaza el saldo inicial; el formulario muestra los movimientos netos y el saldo resultante para evitar duplicaciones conceptuales.

### Categorías

- Página/formulario: `src/pages/CategoriesPage.tsx`, `src/components/categories/CategoryForm.tsx`.
- Hook/servicio: `src/hooks/useCategories.ts`, `src/services/categories.service.ts`.
- Las categorías de gasto son editables. Las cuatro categorías de ingreso son fijas.

### Tarjetas

- Página/formulario: `src/pages/CardsPage.tsx`, `src/components/cards/CreditCardForm.tsx`.
- Historial por tarjeta: `src/components/cards/CardMovementHistory.tsx`.
- Hooks: `src/hooks/useCreditCards.ts`, `useCardCharges.ts`, `useCreditCardMovements.ts`.
- Servicio: `src/services/cards.service.ts`.
- Tablas relacionadas: `credit_cards`, `card_charges`, `card_payments`.
- El historial combina compras (+ deuda), pagos (− deuda) y deuda inicial de la tarjeta seleccionada, y permite eliminar movimientos huérfanos.
- Compra = `EXPENSE` vinculada a `card_charges`; pago = `TRANSFER` vinculada a `card_payments`. Las FK con cascada mantienen la reversión al borrar.
- Soporta deuda HNL y USD; revisa `cards.service.ts` antes de cambiar cálculos o pagos.

### Préstamos

- Página/formularios: `src/pages/LoansPage.tsx`, `src/components/loans/LoanForm.tsx`, `ExtraPaymentModal.tsx`.
- Historial por préstamo: `src/components/loans/LoanMovementHistory.tsx`.
- Hooks/servicio: `src/hooks/useLoans.ts`, `useLoanMovements.ts`, `src/services/loans.service.ts`.
- Los nuevos pagos guardan en `transactions` el préstamo, tipo de pago, capital, interés y saldo posterior; el capital anterior a `0012` se muestra agregado.
- Cálculos puros y pruebas: `src/utils/loan.ts`, `src/utils/loan.test.ts`.

### Personas que me deben

- Ruta/menú: `ROUTES.receivables` (`/personas-que-me-deben`), etiqueta “Por cobrar”.
- Página: `src/pages/ReceivablesPage.tsx`.
- Formularios: `src/components/receivables/ReceivablePersonForm.tsx`, `ReceivableMovementModal.tsx`.
- Hooks: `src/hooks/useReceivables.ts`, `useReceivableMovements.ts`.
- Servicio: `src/services/receivables.service.ts`.
- Tabla principal: `receivable_people`; sus movimientos viven en `transactions` con `receivable_movement_kind` (`LEND`/`REPAYMENT`).
- Saldo por cobrar = dinero prestado − pagos recibidos. Ambos son `TRANSFER`: el primero resta a una cuenta y el segundo suma a la cuenta de depósito.

### Presupuestos

- Página/formulario: `src/pages/BudgetsPage.tsx`, `src/components/budgets/BudgetForm.tsx`.
- Hook/servicio: `src/hooks/useBudgets.ts`, `src/services/budgets.service.ts`.
- Admite presupuesto por categoría de gasto y meta mensual de ahorro.
- El resumen total común suma ambos tipos de presupuesto y sus respectivos avances mediante `utils/finance.ts::budgetOverview`.
- Las categorías con gastos pero sin límite aparecen como “Sin presupuesto” y permiten abrir `BudgetForm` con la categoría preseleccionada.

### Historial y ajustes

- Historial: `src/pages/HistoryPage.tsx`.
- Ajustes: `src/pages/SettingsPage.tsx`.

## Base de datos

- Migraciones: `supabase/migrations/`, aplicadas en orden numérico.
- Descripción de tablas/RLS: `supabase/README.md`.
- Seed opcional: `supabase/seed.sql`.
- Esquema inicial y RLS: `0001`–`0003`.
- Préstamos: `0004`; tipo `SAVING`: `0005`.
- Tarjetas y cuentas: `0006`–`0009`.
- Meta de ahorro: `0010`.
- Categorías fijas de ingreso y depósitos en cuentas: `0011_income_accounts.sql`.
- Vínculo e historial detallado de pagos de préstamos: `0012_loan_payment_history.sql`.
- Tipo contable de transferencia: `0013_add_transfer_type.sql` (ejecutar por separado).
- Transferencias entre cuentas y vínculos reversibles de tarjetas: `0014_card_links_account_transfers.sql`.
- Personas, préstamos entregados y pagos recibidos: `0015_receivables.sql`.
- RLS limita cada fila por `auth.uid()`; no confíes solo en filtros del cliente.

## Despliegue

```text
GitHub main
  -> Cloudflare Workers Build: npm run build
  -> dist/
  -> Deploy: npx wrangler deploy
  -> wrangler.jsonc (assets SPA)
```

- Configuración: `wrangler.jsonc`.
- Variables de build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- `public/_redirects` no debe existir bajo Workers.

## Dónde empezar según la tarea

| Cambio solicitado | Abre primero |
| --- | --- |
| Nueva ruta o menú | `constants/routes.ts`, `constants/nav.ts`, `App.tsx` |
| Ingresos/transacciones | `TransactionForm.tsx`, `TransactionsPage.tsx`, `transactions.service.ts` |
| Saldo o historial de cuenta | `SavingsPage.tsx`, `savings.service.ts` |
| Resumen del dashboard | `DashboardPage.tsx`, `utils/finance.ts` |
| Tarjetas/deuda/pagos | `cards.service.ts`, `CardsPage.tsx` |
| Préstamos/cuotas | `loans.service.ts`, `utils/loan.ts` |
| Personas que deben / cobros | `ReceivablesPage.tsx`, `receivables.service.ts` |
| Presupuestos | `BudgetsPage.tsx`, `budgets.service.ts` |
| Formato o validación | `utils/format.ts`, `utils/date.ts`, `lib/validations.ts` |
| Error de Supabase | servicio del dominio, `lib/errors.ts`, migración relacionada |
| Error de deploy | `wrangler.jsonc`, `package.json`, logs de Cloudflare |

## Comandos

```powershell
npm.cmd run dev
npm.cmd run typecheck
npm.cmd test
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
```
