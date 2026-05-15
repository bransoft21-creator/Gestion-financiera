# Meridian

**Tu dinero, con perspectiva.**

Meridian es una aplicación web de finanzas personales y familiares. Va más allá de registrar ingresos y gastos: calcula el disponible real considerando reservas, obligaciones y compromisos futuros, y usa IA para generar contexto financiero accionable.

## Visión del Producto

La app muestra cuánto dinero está realmente disponible después de considerar gastos realizados, pagos próximos, presupuestos reservados, metas obligatorias, deudas pendientes y gastos del hogar compartido.

Meridian ayuda al usuario a:

- Controlar ingresos y gastos personales y del hogar.
- Organizar transacciones por categorías.
- Gestionar presupuestos mensuales.
- Administrar gastos recurrentes (personales y del hogar).
- Crear y seguir metas de ahorro.
- Gestionar deudas y pagos próximos.
- Visualizar reportes financieros.
- Importar transacciones desde PDF, CSV o imagen con IA (Smart Import).
- Obtener análisis mensuales y reflexiones semanales con IA.

## Principio Clave

El dinero disponible real no se calcula como una simple resta entre ingresos y gastos.

```
Disponible real = Ingresos − Gastos − Reservado (presupuestos) − Obligaciones (recurrentes + metas + deudas)
```

Esta fórmula vive en `server/services/financial-ledger.ts`. No se recalcula en UI.

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js App Router + TypeScript |
| UI | Tailwind CSS + shadcn/ui + Design System V2 propio |
| Base de datos | PostgreSQL via Supabase + Prisma ORM |
| Auth | Supabase Auth |
| Formularios | React Hook Form + Zod |
| Charts | Recharts |
| IA | OpenAI API (HTTP directo, sin SDK wrapper) |
| Rate limiting | Upstash Redis |
| Error tracking | Sentry |
| Animaciones | Framer Motion |
| PWA | @ducanh2912/next-pwa (deshabilitado por defecto en beta) |

**No se usa TanStack Query.** El proyecto usa fetch directo.

## Documentación adicional

| Documento | Descripción |
|-----------|-------------|
| `../README.md` | Setup rápido, comandos, variables de entorno |
| `ARCHITECTURE.md` | Estructura técnica y reglas de implementación |
| `FINANCIAL_FORMULAS.md` | Fórmulas financieras oficiales |
| `TODO.md` | Estado real de cada módulo |
| `PWA_AUDIT.md` | Estado y decisiones sobre PWA |
| `BETA_OPERABILITY_CHECKLIST.md` | Checklist de operación en beta |
| `LAUNCH_SAFETY_CHECKLIST.md` | Checklist de seguridad pre-lanzamiento |
