# Fórmulas financieras oficiales

El dashboard usa `occurredAt` como fecha efectiva de transacción y calcula cada período con días calendario de Argentina.

## Métricas centrales

- Ingresos: suma de transacciones confirmadas tipo `INCOME` del mes.
- Gastos: suma de transacciones confirmadas tipo `EXPENSE` del mes.
- Balance: `ingresos - gastos`.
- Reservado: suma por presupuesto de `max(monto planificado - gasto real de esa categoría, 0)`.
- Obligaciones: recurrentes activos vencidos en el mes + aportes mensuales de metas activas + pagos de deuda vencidos en el mes.
- Pago de deuda del mes: `min(pago mínimo || saldo pendiente, saldo pendiente)`.
- Disponible real: `balance - reservado - obligaciones`.
- Tasa de ahorro: `max(balance, 0) / ingresos`, o `0` si no hay ingresos.
- Deuda total: suma de saldos pendientes de deudas activas.

Las transferencias y ajustes afectan saldos de cuentas, pero no forman parte de ingresos/gastos del dashboard.
