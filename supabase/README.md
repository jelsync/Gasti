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
│   └── 0009_dual_currency_cards.sql # Tarjetas con deuda en L y $ a la vez
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
| `transactions` | Ingresos y gastos.                                      |
| `budgets`      | Presupuesto mensual por categoría.                      |
| `loans`        | Préstamos (saldo/pasivo). Las cuotas se registran como transacciones. |
| `credit_cards` | Tarjetas de crédito. Deuda = apertura + compras − pagos.       |
| `card_payments`| Pagos a tarjetas (reducen la deuda, no son gastos).            |
| `savings_accounts` | Cuentas de ahorro. Saldo = apertura + aportes (SAVING).    |

### Decisiones de diseño

- **Enum `transaction_type`** (`INCOME` / `EXPENSE`) para integridad.
- **Categorías por usuario**: al registrarse, cada usuario recibe una copia de
  las categorías predeterminadas (`is_default = true`) y puede editarlas o crear
  nuevas. Esto mantiene la regla uniforme `auth.uid() = user_id` en todas las tablas.
- **`transactions.category_id` → `ON DELETE SET NULL`**: borrar una categoría no
  destruye el historial; la transacción queda como "Sin categoría".
- **`budgets.category_id` → `ON DELETE CASCADE`**: un presupuesto no tiene sentido
  sin su categoría.
- **Índices** en `(user_id, transaction_date)`, `(user_id, type, transaction_date)`
  y `(user_id, category_id)` para el dashboard y el historial.

## Seguridad (RLS)

Todas las tablas tienen **Row Level Security activado**. Las policies garantizan
que cada usuario solo pueda ver y modificar filas donde `auth.uid() = user_id`
(en `profiles`, `auth.uid() = id`), para `SELECT`, `INSERT`, `UPDATE` y `DELETE`.

La seguridad vive en PostgreSQL, no en el cliente React.
