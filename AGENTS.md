# Guía para agentes

## Inicio eficiente

- Lee primero `CODEGRAPH.md`; úsalo como índice principal del repositorio.
- No recorras ni leas todo el proyecto por defecto. Localiza símbolos con `rg` y abre únicamente los archivos señalados por `CODEGRAPH.md` y sus dependencias directas.
- Si el mapa parece desactualizado, confirma la sección afectada con búsquedas dirigidas antes de ampliar la inspección.
- No leas, imprimas ni modifiques valores de `.env.local`. Solo puede consultarse `.env.example` para conocer nombres de variables.

## Proyecto

- Aplicación SPA de finanzas personales: React 19, TypeScript, Vite 7 y Supabase.
- No existe backend propio. El acceso a datos va desde `services/` a Supabase y la seguridad depende de RLS.
- Usa el alias `@/` para imports desde `src/`.
- Conserva el diseño y los componentes existentes en `src/components/ui/`.
- Interfaz, mensajes y documentación dirigidos al usuario deben escribirse en español.

## Reglas de dominio que no deben romperse

- Un movimiento `INCOME` siempre suma a ingresos del dashboard.
- Un `INCOME` puede vincularse opcionalmente a `savings_account_id`; en ese caso también aumenta el saldo y aparece en el historial de esa cuenta, sin crear otra transacción.
- Saldo de cuenta = `opening_balance` + `INCOME`/`SAVING` vinculados − `EXPENSE` vinculados.
- Un gasto normal (`EXPENSE`) debe seleccionar `savings_account_id` y debitar esa cuenta. Esta regla no se extiende automáticamente a cargos o pagos de tarjeta.
- Las únicas categorías de ingreso son: `Salario`, `Transferencia de papá`, `Bonos` y `Otros ingresos`.
- Las compras con tarjeta aumentan deuda y crean el gasto que alimenta dashboard/presupuesto; los pagos reducen deuda y son transferencias desde una cuenta, no un segundo gasto.
- El historial de una tarjeta combina `card_charges` y `card_payments`, separado por tarjeta y moneda.
- Borrar una transacción vinculada a una compra o pago debe revertir también el movimiento de tarjeta mediante cascada.
- `TRANSFER` mueve saldo entre cuentas (o de una cuenta a una tarjeta) y no suma ingresos, gastos ni ahorro.
- Un gasto en una categoría sin límite mensual se muestra como no presupuestado; nunca se crea automáticamente un presupuesto retroactivo.
- Los nuevos pagos de préstamo deben vincular la transacción al préstamo y conservar pago total, capital, interés y saldo posterior.
- No debilites RLS ni uses claves `service_role`/`sb_secret_*` en el frontend. Toda variable `VITE_*` es pública en el navegador.

## Base de datos

- No reescribas migraciones que ya pudieron aplicarse. Crea la siguiente migración numerada en `supabase/migrations/`.
- Mantén sincronizados `src/types/database.types.ts`, `src/types/models.ts` y las validaciones cuando cambie el esquema.
- Las migraciones se aplican al proyecto remoto desde Supabase SQL Editor o CLI; un build frontend no las ejecuta.

## Despliegue

- Producción usa Cloudflare Workers con `wrangler.jsonc`.
- Build: `npm run build`. Deploy: `npx wrangler deploy`. Assets: `dist/`.
- El fallback SPA se configura con `assets.not_found_handling = "single-page-application"`.
- No recrees `public/_redirects`: la regla heredada de Pages provoca un ciclo infinito en Workers.
- Variables requeridas: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (publishable/anon, nunca secret/service_role).

## Verificación

- En Windows, si PowerShell bloquea `npm.ps1`, usa `npm.cmd`.
- Para cambios normales ejecuta, como mínimo: `npm.cmd run typecheck`, `npm.cmd test` y `npm.cmd run build`.
- Para cambios de UI/TS ejecuta además ESLint y Prettier sobre los archivos modificados.
- No corrijas ni descartes cambios ajenos al objetivo.

## Mantener el mapa

- Actualiza `CODEGRAPH.md` en el mismo cambio si agregas o renombras rutas, páginas, hooks, servicios, tablas, migraciones, reglas financieras o configuración de despliegue.
- El mapa debe seguir siendo breve: registra responsabilidades y relaciones, no copies implementaciones.
