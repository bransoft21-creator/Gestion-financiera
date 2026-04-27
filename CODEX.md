# Instrucciones para Codex

## Proyecto

Nombre: Finance Control

Aplicación web profesional para gestión financiera personal y familiar.

El objetivo es ayudar al usuario a:
- controlar ingresos
- controlar gastos
- gestionar presupuestos
- detectar gastos innecesarios
- gestionar deudas
- crear metas de ahorro
- calcular dinero disponible real
- preparar una futura etapa de inversiones

## Stack obligatorio

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma ORM
- PostgreSQL / Supabase
- Supabase Auth
- React Hook Form
- Zod
- TanStack Query
- Recharts

## Enfoque inicial

Construir primero un MVP sólido, escalable y profesional.

No desarrollar todo de golpe.

## Reglas de trabajo

- Trabajar por fases pequeñas.
- Antes de cambios grandes, explicar brevemente el plan.
- No reescribir archivos completos si no es necesario.
- Mantener código limpio, tipado y escalable.
- Separar lógica de negocio, UI y acceso a datos.
- Usar Zod para validar formularios y APIs.
- Usar Prisma para acceso a base de datos.
- Usar componentes reutilizables.
- Pensar mobile first.
- Actualizar TODO.md al finalizar cada fase.

## Funcionalidades MVP

1. Autenticación de usuarios.
2. Dashboard financiero.
3. CRUD de transacciones.
4. Categorías.
5. Presupuesto mensual.
6. Gastos recurrentes.
7. Metas financieras.
8. Deudas.
9. Reportes básicos.
10. Preparación futura para inversiones.

## Regla clave de negocio

La app debe diferenciar entre:

- dinero ingresado
- gasto real
- dinero reservado
- dinero disponible
- dinero destinado a metas
- deuda pendiente

El dinero disponible real no debe ser simplemente ingresos menos gastos.

Debe considerar:
- gastos realizados
- pagos próximos
- presupuestos reservados
- metas obligatorias
- deudas próximas

## Arquitectura esperada

Usar una estructura similar a:

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