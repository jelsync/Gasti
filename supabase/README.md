# Base de datos de Gasti (Supabase / PostgreSQL)

Este directorio contiene todo lo necesario para recrear la base de datos.

## Estructura

```
supabase/
├── migrations/
│   ├── 0001_init.sql          # Tipos, tablas, índices y constraints
│   ├── 0002_rls.sql           # Row Level Security + policies
│   └── 0003_triggers_seed.sql # updated_at, alta de usuario y seed de categorías
├── seed.sql                   # Seed opcional para usuarios preexistentes
└── README.md
```

## Cómo aplicar (SQL Editor de Supabase)

1. Entra a tu proyecto en https://supabase.com → **SQL Editor**.
2. Ejecuta en orden el contenido de:
   1. `migrations/0001_init.sql`
   2. `migrations/0002_rls.sql`
   3. `migrations/0003_triggers_seed.sql`
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
