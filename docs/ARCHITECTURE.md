# Arquitectura

Meridian es una aplicación Next.js App Router con TypeScript. Separa UI, lógica de negocio, validaciones y acceso a datos.

## Estructura de Carpetas Real

```txt
/app                    — Next.js App Router (rutas, layouts, páginas, API routes)
  /(private)            — Rutas protegidas (requieren auth)
  /api                  — REST endpoints
  /auth                 — Flujos de autenticación
  /onboarding           — Onboarding de nuevos usuarios

/components             — Componentes UI organizados por dominio
  /app                  — Chrome de la aplicación (shell, nav, modales)
  /ui                   — Base shadcn/ui
  /ui-v2                — Primitivos V2 (PremiumCard, etc.)
  /dashboard            — Componentes del dashboard
  /household            — Componentes del módulo hogar
  /finance              — Componentes financieros compartidos
  /copilot              — Componentes de IA/copilot
  /insights             — Feed de insights y actividad
  /layout               — Primitivos de layout de página

/server                 — Lógica server-side pura
  /services             — Servicios de dominio (financial-ledger, transactions, etc.)
  /schemas              — Schemas Zod para validación de API
  /auth                 — Helpers de autenticación server-side

/hooks                  — React hooks compartidos
/lib                    — Utilidades (dates.ts, prisma.ts, feature-flags.ts, finance/)
/prisma                 — Schema, migraciones, seed
/design-system          — Tokens y principios del Design System V2
/docs                   — Documentación del proyecto
/tests                  — Tests automatizados
```

**No existe `/features/`** — la lógica de dominio vive en `/server/services/`.  
**No existe `/types/`** — los tipos de cada módulo viven junto a su ruta en `app/(private)/<módulo>/types.ts`.

## Responsabilidades por Carpeta

### `/app`

Rutas, layouts, páginas y boundaries propios de Next.js App Router. Composición de vistas, metadata y entry points de cada sección.

### `/components`

Componentes reutilizables de UI. Shadcn/ui base en `/ui`, primitivos V2 en `/ui-v2`, componentes de dominio en subcarpetas propias.

### `/server`

Lógica server-side, servicios de dominio, queries, schemas Zod y helpers de auth. La lógica de negocio financiera vive aquí.

### `/lib`

Utilidades compartidas: `dates.ts` (timezone Argentina), `prisma.ts` (cliente Prisma), `feature-flags.ts`, helpers de dinero.

### `/hooks`

Hooks compartidos entre módulos. Hooks específicos de un módulo viven junto a su ruta.

### `/prisma`

Schema de Prisma, migraciones y seed scripts.

## Reglas de Implementación

- Usar Zod para validar formularios y APIs.
- Usar Prisma para acceso a datos.
- Usar Supabase Auth para autenticación.
- Usar React Hook Form para formularios.
- **No usar TanStack Query** — fetch directo en todos los casos.
- Usar Recharts para reportes y visualizaciones.
- Mantener componentes reutilizables y tipados.
- Separar lógica de negocio, UI y acceso a datos.
- Pensar mobile first desde el inicio.
- Montos sensibles siempre con `<SensitiveAmount>`.
- Fechas con timezone Argentina siempre desde `lib/dates.ts`.
- Formularios flotantes/panel siempre con `AppFormPanel` de `components/app/mobile-form.tsx`.

## Modelo de Dominio

Entidades principales implementadas:

- UserProfile / Account
- Transaction / Category
- Budget (presupuesto mensual)
- RecurringExpense (personal)
- Goal (meta financiera)
- Debt / DebtPayment
- Household / HouseholdMember
- HouseholdRecurringPayment / HouseholdRecurringOccurrence
- HouseholdBalance / HouseholdSettlement
- ActivityLog / Notification

## Ledger Financiero

La lógica contable compartida vive en `server/services/financial-ledger.ts`.

```
Disponible real = Ingresos − Gastos − Reservado − Obligaciones
```

Las pantallas no recalculan saldos o efectos financieros críticos por su cuenta.

Efectos de transacciones:

- `INCOME` / `ADJUSTMENT` — aumentan la cuenta origen.
- `EXPENSE` / `DEBT_PAYMENT` / `GOAL_CONTRIBUTION` — reducen la cuenta origen.
- `TRANSFER` — reduce cuenta origen, aumenta cuenta destino.
- `DEBT_PAYMENT` — también reduce el saldo pendiente de la deuda asociada.
- `GOAL_CONTRIBUTION` — también aumenta el monto actual de la meta asociada.

Convención de saldos:

- `Account.currentBalance` y `Account.openingBalance` son saldos firmados.
- Cuentas de activo con saldo positivo suman a activos.
- Tarjeta de crédito con deuda debe tener saldo negativo.
- Patrimonio neto = suma de saldos firmados de cuentas activas.
