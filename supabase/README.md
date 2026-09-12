# Base de datos de Gasti (Supabase / PostgreSQL)

Este directorio contiene todo lo necesario para recrear la base de datos.

## Estructura

```
supabase/
├── migrations/
│   ├── 0001_init.sql          # Tipos, tablas, índices y constraints
│   ├── 0002_rls.sql           # Row Level Security + policies
│   ├── 0003_triggers_seed.sql # updated_at, alta de usuario y seed de categorías
│   ├── 0004_loans.sql         # Préstamos (tabla + RLS + trigger)
│   ├── 0005_add_saving_type.sql # Agrega el tipo de movimiento SAVING (ejecutar solo)
│   ├── 0006_cards_savings.sql # Tarjetas de crédito y cuentas de ahorro
│   ├── 0007_card_currency.sql # Moneda (HNL/USD) de las tarjetas
│   ├── 0008_card_charges.sql  # Compras/cargos de tarjetas (deuda en su moneda)
│   ├── 0009_dual_currency_cards.sql # Tarjetas con deuda en L y $ a la vez
│   ├── 0010_savings_budget.sql # Meta de ahorro en presupuestos
│   ├── 0011_income_accounts.sql # Categorías de ingreso y depósitos en cuentas
│   ├── 0012_loan_payment_history.sql # Historial detallado de pagos de préstamos
│   ├── 0013_add_transfer_type.sql # Agrega TRANSFER al enum (ejecutar solo)
│   ├── 0014_card_links_account_transfers.sql # Reversiones y transferencias
│   ├── 0015_receivables.sql # Personas que deben y pagos recibidos
│   ├── 0016_currencies_savings_goal.sql # Monedas y cuentas incluidas en meta
│   ├── 0017_generic_income_account_numbers.sql # Ingresos genéricos y número de cuenta
│   ├── 0018_recurring_transactions.sql # Reglas mensuales confirmables
│   ├── 0019_financial_calendar.sql # Días de pago de préstamos y tarjetas
│   ├── 0020_monthly_reconciliation.sql # Conciliación y cierre mensual
│   └── 0021_financial_goals.sql # Metas y progreso reservado
├── seed.sql                   # Seed opcional para usuarios preexistentes
└── README.md
```

## Cómo aplicar (SQL Editor de Supabase)

1. Entra a tu proyecto en https://supabase.com → **SQL Editor**.
2. Ejecuta en orden el contenido de:
   1. `migrations/0001_init.sql`
   2. `migrations/0002_rls.sql`
   3. `migrations/0003_triggers_seed.sql`
   4. `migrations/0004_loans.sql`
   5. `migrations/0005_add_saving_type.sql`  (ejecútala sola: agrega un valor al enum)
   6. `migrations/0006_cards_savings.sql`
   7. `migrations/0007_card_currency.sql`
   8. `migrations/0008_card_charges.sql`
   9. `migrations/0009_dual_currency_cards.sql`
   10. `migrations/0010_savings_budget.sql`
   11. `migrations/0011_income_accounts.sql`
   12. `migrations/0012_loan_payment_history.sql`
   13. `migrations/0013_add_transfer_type.sql` (ejecútala sola: agrega un valor al enum)
   14. `migrations/0014_card_links_account_transfers.sql`
   15. `migrations/0015_receivables.sql`
   16. `migrations/0016_currencies_savings_goal.sql`
   17. `migrations/0017_generic_income_account_numbers.sql`
   18. `migrations/0018_recurring_transactions.sql`
   19. `migrations/0019_financial_calendar.sql`
   20. `migrations/0020_monthly_reconciliation.sql`
   21. `migrations/0021_financial_goals.sql`
3. (Opcional) Si ya tenías usuarios creados antes de aplicar el paso 3,
   ejecuta `seed.sql` para sembrarles las categorías predeterminadas.

> Los tres archivos son idempotentes: puedes re-ejecutarlos sin duplicar objetos.

## Cómo aplicar (Supabase CLI)

```bash
supabase link --project-ref <tu-project-ref>
supabase db push
```

## Modelo de datos

| Tabla          | Descripción                                             |
| -------------- | ------------------------------------------------------- |
| `profiles`     | Perfil del usuario (1:1 con `auth.users`).              |
| `categories`   | Categorías de ingreso/gasto propias de cada usuario.    |
| `transactions` | Ingresos, gastos, ahorro y transferencias con moneda; también vincula tarjetas y préstamos. |
| `budgets`      | Presupuesto mensual por categoría y moneda, o meta de ahorro HNL. |
| `loans`        | Préstamos (saldo/pasivo), con día mensual opcional para calendario. Las cuotas y abonos se registran como transacciones vinculadas. |
| `credit_cards` | Tarjetas de crédito, con día límite opcional. Deuda = apertura + compras − pagos. |
| `card_payments`| Pagos a tarjetas (reducen la deuda, no son gastos).            |
| `savings_accounts` | Cuentas con número opcional copiable. Saldo = apertura + ingresos/aportes − gastos vinculados; pueden incluirse en la meta de ahorro. |
| `receivable_people` | Personas con dinero pendiente; el saldo se deriva de préstamos y pagos. |
| `recurring_transactions` | Reglas mensuales que no mueven dinero hasta ser confirmadas. |
| `recurring_occurrences` | Fechas confirmadas u omitidas; evita registrar el mismo movimiento dos veces. |
| `account_reconciliations` | Comparaciones de saldo y ajustes identificables por cuenta. |
| `month_closures` | Fotografías mensuales actualizables; no bloquean correcciones. |
| `financial_goals` | Objetivos HNL independientes con cuenta de referencia opcional. |
| `financial_goal_movements` | Aportes y retiros del progreso reservado; no mueven saldos bancarios. |

### Decisiones de diseño

- **Enum `transaction_type`** (`INCOME` / `EXPENSE` / `SAVING` / `TRANSFER`) para integridad.
- **Categorías por usuario**: al registrarse, cada usuario recibe una copia de
  las categorías predeterminadas (`is_default = true`) y puede editarlas o crear
  nuevas. Esto mantiene la regla uniforme `auth.uid() = user_id` en todas las tablas.
- **`transactions.category_id` → `ON DELETE SET NULL`**: borrar una categoría no
  destruye el historial; la transacción queda como "Sin categoría".
- **`budgets.category_id` → `ON DELETE CASCADE`**: un presupuesto no tiene sentido
  sin su categoría.
- **Índices** en `(user_id, transaction_date)`, `(user_id, type, transaction_date)`
  y `(user_id, category_id)` para el dashboard y el historial.
- **Compras con tarjeta**: crean un gasto en la moneda de la compra; el cargo vinculado aumenta la deuda.
- **Monedas separadas**: los importes HNL y USD no se suman ni convierten automáticamente.
- **Pagos de tarjeta**: son transferencias desde una cuenta y no duplican el gasto.
- **Transferencias entre cuentas**: restan al origen, suman al destino y no alteran ingresos/gastos.
- **Conciliaciones**: una diferencia aplicada ajusta únicamente el saldo de cuenta y se revierte al eliminarla.
- **Metas independientes**: el progreso reservado no duplica movimientos de la cuenta vinculada.

## Seguridad (RLS)

Todas las tablas tienen **Row Level Security activado**. Las policies garantizan
que cada usuario solo pueda ver y modificar filas donde `auth.uid() = user_id`
(en `profiles`, `auth.uid() = id`), para `SELECT`, `INSERT`, `UPDATE` y `DELETE`.

La seguridad vive en PostgreSQL, no en el cliente React.
