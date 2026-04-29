# Arquitectura

Finance Control debe organizarse como una aplicacion Next.js App Router con TypeScript, separando UI, logica de negocio, validaciones y acceso a datos.

## Estructura Tecnica

```txt
/app
/components
/features
/hooks
/lib
/server
/prisma
/types
/docs
```

## Responsabilidades por Carpeta

### `/app`

Rutas, layouts, paginas y boundaries propios de Next.js App Router. Debe contener composicion de vistas, metadata y entry points de cada seccion.

### `/components`

Componentes reutilizables y genericos de UI. Debe incluir componentes basados en shadcn/ui, elementos de layout, estados vacios, loaders, modales y piezas compartidas.

### `/features`

Modulos funcionales del dominio. Cada feature debe agrupar su UI especifica, hooks, schemas, tipos locales y acciones necesarias.

Features esperadas para el MVP:

- `auth`
- `dashboard`
- `transactions`
- `categories`
- `budgets`
- `recurring-expenses`
- `goals`
- `debts`
- `reports`

### `/hooks`

Hooks compartidos entre features. Los hooks especificos de una feature deben vivir dentro de su modulo en `/features`.

### `/lib`

Utilidades compartidas, configuracion de clientes, helpers de fechas, dinero, formato, validaciones comunes y constantes de aplicacion.

### `/server`

Logica server-side, servicios de dominio, queries, mutations, server actions y adaptadores para acceso seguro a datos. La logica de negocio financiera debe vivir aca o dentro de servicios especificos por feature.

### `/prisma`

Schema de Prisma, migraciones y seed scripts. Prisma debe ser la capa principal de acceso a PostgreSQL/Supabase.

### `/types`

Tipos globales compartidos por la aplicacion.

### `/docs`

Documentacion viva del proyecto: vision, arquitectura, roadmap, decisiones tecnicas y pendientes.

## Reglas de Implementacion

- Usar Zod para validar formularios, server actions y APIs.
- Usar Prisma para acceso a datos.
- Usar Supabase Auth para autenticacion.
- Usar React Hook Form para formularios.
- Usar TanStack Query para sincronizacion de datos en cliente cuando corresponda.
- Usar Recharts para reportes y visualizaciones.
- Mantener componentes reutilizables y tipados.
- Separar logica de negocio, UI y acceso a datos.
- Pensar mobile first desde el inicio.
- Los formularios que se abren como modal, sheet, drawer o panel flotante deben usar `AppFormPanel` desde `components/app/mobile-form.tsx`, junto con `appFormContentClass` y `appFormActionsClass`. Ese componente centraliza overlay, `dvh`, scroll interno, bloqueo de scroll del body, footer sticky y safe-area mobile.

## Modelo de Dominio Inicial

Entidades principales esperadas:

- Usuario
- Cuenta o billetera
- Transaccion
- Categoria
- Presupuesto mensual
- Gasto recurrente
- Meta financiera
- Deuda
- Pago o movimiento asociado a deuda

## Regla de Dinero Disponible

El calculo de dinero disponible real debe considerar al menos:

- Ingresos confirmados.
- Gastos realizados.
- Pagos proximos.
- Presupuestos reservados.
- Aportes obligatorios a metas.
- Deudas proximas.

Este calculo debe mantenerse como logica de dominio reutilizable, no como una resta aislada dentro de una pantalla.

## Ledger Financiero

La logica contable compartida vive en `server/services/financial-ledger.ts`.
Las pantallas y servicios de dominio no deben recalcular saldos o efectos
financieros criticos por su cuenta cuando exista una funcion del ledger.

Convencion de saldos:

- `Account.currentBalance` y `Account.openingBalance` son saldos firmados.
- Cuentas de activo con saldo positivo suman a activos.
- Cualquier cuenta con saldo negativo suma a pasivos por su valor absoluto.
- Una tarjeta de credito con deuda debe tener saldo negativo.
- Un pago de tarjeta se modela como transferencia desde la cuenta pagadora hacia la tarjeta; esa transferencia reduce la cuenta origen y aumenta el saldo de la tarjeta hacia cero.
- El patrimonio neto se calcula como la suma de saldos firmados de cuentas activas, sin conversion automatica de moneda.

Efectos de transacciones:

- `INCOME` y `ADJUSTMENT` aumentan la cuenta origen.
- `EXPENSE`, `DEBT_PAYMENT`, `GOAL_CONTRIBUTION` e `INVESTMENT` reducen la cuenta origen.
- `TRANSFER` reduce la cuenta origen y aumenta la cuenta destino.
- `DEBT_PAYMENT` tambien reduce el saldo pendiente de la deuda asociada.
- `GOAL_CONTRIBUTION` tambien aumenta el monto actual de la meta asociada.
