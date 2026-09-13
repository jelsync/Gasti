# Roadmap por fases de Gasti

Las fases se entregan y validan por separado. Una fase posterior no debe cambiar las reglas contables de una fase aprobada sin una migración explícita.

## Fase 1 — Transacciones recurrentes (implementada)

- Reglas mensuales para ingresos y gastos.
- Gastos desde una cuenta o como cargo de tarjeta en HNL/USD.
- Ingresos depositados opcionalmente en una cuenta.
- Confirmación manual antes de afectar saldos, deuda, presupuestos o reportes.
- Opción de omitir/restaurar una ocurrencia, pausar la regla y evitar duplicados.

## Fase 2 — Calendario financiero y avisos (implementada)

- Calendario de movimientos recurrentes, cuotas y fechas de pago.
- Indicadores de próximos, vencidos y presupuestos cerca del límite.
- Avisos dentro del dashboard y del calendario; las notificaciones externas quedan como mejora posterior.

## Fase 3 — Conciliación y cierre mensual (implementada)

- Comparar saldo calculado con saldo real de cada cuenta.
- Registrar ajustes identificables y documentar diferencias.
- Cerrar el mes conservando una fotografía histórica sin bloquear correcciones autorizadas.

## Fase 4 — Metas y salud financiera (implementada)

- Metas independientes: emergencia, viaje, vehículo u otras.
- Cuenta vinculada, monto objetivo, fecha y progreso.
- Indicadores explicables de ahorro, gasto, deuda y comparación mensual.

## Fase 5 — Portabilidad y respaldo (implementada)

- Ajustes: exportación CSV/Excel de movimientos del mes o de todo el historial.
- Reporte mensual Excel con resumen HNL/USD, categorías y movimientos.
- Respaldo JSON completo por usuario, versionado y consistente; incluye las 16 tablas de aplicación. La restauración automática queda fuera de esta fase.
- Importación bancaria CSV UTF-8 para cuentas HNL: columnas y formatos configurables, vista previa, categorías y selección por fila.
- Posibles duplicados por cuenta, fecha, monto y sentido; confirmación explícita, lote atómico y reintentos sin duplicar.
- Requiere aplicar `0022_portability.sql`. Los pagos de tarjeta, préstamos y transferencias se registran desde sus formularios específicos.

## Fase 6 — Seguridad y adopción

- Modo privado global y ampliación a deudas/presupuestos.
- Bloqueo local mediante PIN y cierre por inactividad.
- Guía inicial para crear cuentas, presupuestos y el primer ingreso.
