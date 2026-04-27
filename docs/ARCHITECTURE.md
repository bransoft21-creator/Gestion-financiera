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
