# Gasti

**Gasti** es una aplicación web para llevar el control de tus **gastos e ingresos personales** mes a mes: dashboard financiero, transacciones, categorías, presupuestos, historial, filtros y reportes con gráficos. Cada usuario accede únicamente a sus propios datos.

Moneda por defecto: **Lempira hondureño (HNL, `L`)**.

---

## Stack tecnológico

| Capa            | Tecnología                                            |
| --------------- | ----------------------------------------------------- |
| Frontend        | React 19, TypeScript, Vite 7                          |
| Estilos         | Tailwind CSS v4 (modo claro/oscuro)                   |
| Backend / BaaS  | Supabase (Auth + PostgreSQL + Row Level Security)     |
| Formularios     | React Hook Form + Zod                                 |
| Gráficos        | Recharts (carga diferida)                             |
| Notificaciones  | Sonner                                                |
| Iconos          | lucide-react                                          |
| Testing         | Vitest + Testing Library                              |
| Calidad         | ESLint 9 (flat config) + Prettier                     |

No hay backend propio: la primera versión aprovecha Supabase directamente. La seguridad de datos vive en PostgreSQL mediante RLS, no solo en el cliente.

---

## Arquitectura

```
Navegador (React SPA)
        │  Supabase JS SDK (anon key)
        ▼
Supabase
 ├── Auth (registro, login, sesión, recuperación)
 └── PostgreSQL + Row Level Security  ← cada usuario solo ve sus filas
```

### Estructura del frontend

```
src/
├── components/     # UI reutilizable, layout, gráficos, formularios
│   ├── ui/         # Primitivos (Button, Input, Card, Modal, ...)
│   ├── layout/     # Sidebar, Header
│   ├── transactions/, categories/, budgets/, dashboard/, reports/, routing/
├── contexts/       # Auth y Theme (provider + hook separados)
├── hooks/          # useTransactions, useCategories, useBudgets
├── layouts/        # AuthLayout, AppLayout
├── lib/            # supabase, validations (zod), errors, icons, utils
├── pages/          # Dashboard, Transacciones, Presupuestos, Historial, ...
├── services/       # Acceso a datos (Supabase) por dominio
├── types/          # Tipos de BD y modelos de dominio
└── utils/          # format (HNL), date, finance (cálculos)
```

---

## Requisitos

- **Node.js 20.19+ / 22.12+** (probado con Node 24) y npm.
- Una cuenta gratuita de **Supabase**.

---

## Instalación

```powershell
# En C:\Fuentes\Aws\Demos\Gasti
npm install
```

## Variables de entorno

Copia el ejemplo y complétalo con los datos de tu proyecto Supabase:

```powershell
Copy-Item .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_public_key
```

> `.env.local` está en `.gitignore`. **Nunca** se versionan secretos.
> La `service_role` key **no** se usa en el frontend.

## Configuración de Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta en orden:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_triggers_seed.sql`
3. En **Authentication → URL Configuration**, agrega a *Redirect URLs*:
   `http://localhost:5173/**` (y tu dominio de producción cuando despliegues).
4. (Opcional, para pruebas locales) En **Authentication → Providers → Email**,
   desactiva *Confirm email* para que el registro sea inmediato.
5. Copia **Project URL** y **anon public key** (Project Settings → API) a `.env.local`.

Ver detalles del esquema y las políticas en [`supabase/README.md`](./supabase/README.md).

## Ejecución local

```powershell
npm run dev
```

Abre http://localhost:5173

---

## Scripts disponibles

| Script                 | Descripción                                  |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Servidor de desarrollo (Vite).               |
| `npm run build`        | Typecheck + build de producción.             |
| `npm run preview`      | Sirve el build de producción localmente.     |
| `npm run lint`         | ESLint.                                       |
| `npm run format`       | Formatea con Prettier.                        |
| `npm run typecheck`    | Verifica tipos (TypeScript).                  |
| `npm test`             | Ejecuta las pruebas (Vitest).                 |

---

## Base de datos

| Tabla          | Descripción                                          |
| -------------- | ---------------------------------------------------- |
| `profiles`     | Perfil del usuario (1:1 con `auth.users`).           |
| `categories`   | Categorías de ingreso/gasto por usuario.             |
| `transactions` | Ingresos y gastos.                                   |
| `budgets`      | Presupuesto mensual por categoría.                   |

Al registrarse, un trigger crea el perfil y **siembra categorías predeterminadas**
(Alimentación, Transporte, Salario, etc.), que el usuario puede editar o ampliar.

## Seguridad / RLS

- **Row Level Security activado** en todas las tablas.
- Las políticas garantizan `auth.uid() = user_id` (en `profiles`, `auth.uid() = id`)
  para `SELECT`, `INSERT`, `UPDATE` y `DELETE`.
- Un usuario **nunca** puede leer ni modificar datos de otro, aunque manipule el cliente.
- La `anon key` es pública por diseño; la protección real la da RLS en PostgreSQL.

> Nota de desarrollo: el servidor de Vite/esbuild tiene una advisory conocida que solo
> afecta al entorno local de desarrollo, no al build estático de producción.

---

## Deploy (Cloudflare Pages)

El build genera archivos estáticos en `dist/`, ideales para Cloudflare Pages:

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Variables de entorno:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Recuerda agregar el dominio de producción a las *Redirect URLs* de Supabase.

Como es una SPA, configura un *fallback* a `index.html` (Cloudflare Pages lo hace
automáticamente para rutas no encontradas con un archivo `_redirects` si fuese necesario:
`/*  /index.html  200`).

---

## Pruebas

Se priorizan la lógica crítica: cálculos financieros, formato de moneda/fechas y
validaciones.

```powershell
npm test
```

---

## Licencia

Proyecto personal. Sin licencia comercial asociada.
