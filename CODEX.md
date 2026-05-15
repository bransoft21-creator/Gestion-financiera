# Instrucciones para Codex

## Proyecto

Nombre: **Meridian**

Aplicación web de finanzas personales y familiares. Calcula el dinero disponible real considerando gastos realizados, reservas, obligaciones y compromisos futuros. Incluye IA para análisis mensual, reflexión semanal e importación inteligente de documentos.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui + Design System V2 propio
- Prisma ORM
- PostgreSQL / Supabase
- Supabase Auth
- React Hook Form + @hookform/resolvers
- Zod
- Recharts
- OpenAI API (HTTP directo, sin SDK wrapper)
- Upstash Redis (rate limiting)
- Framer Motion
- Sentry

**No usar TanStack Query** — el proyecto no lo tiene instalado. Usar fetch directo.

## Estructura de carpetas real

```txt
/app          — Next.js App Router (rutas, layouts, pages, API routes)
/components   — UI organizada por dominio (ui/, ui-v2/, dashboard/, household/, etc.)
/hooks        — React hooks compartidos
/lib          — Utilidades (dates.ts, prisma.ts, feature-flags.ts, finance/)
/server       — Lógica server-side (services/, schemas/, auth/)
/prisma       — Schema, migraciones, seed
/design-system — Tokens y principios de Design System V2
/docs         — Documentación del proyecto
/tests        — Tests automatizados
```

**No existe `/features/`** — la lógica de dominio vive en `/server/services/`.

## Control de tokens (crítico)

Optimiza al máximo el uso de tokens. Obligatorio.

1. Responde siempre de forma concisa, directa y accionable.
2. No expliques teoría innecesaria.
3. No repitas contexto ya mencionado.
4. No hagas resúmenes largos.
5. No generes código completo si no es necesario.
6. Solo muestra: diff o fragmentos modificados, funciones afectadas, archivos impactados.
7. Si un cambio es grande: divide en pasos pequeños y entrega uno por vez.
8. No avances a la siguiente fase sin confirmación.
9. Si algo es obvio o estándar, omítelo.
10. Prioriza listas cortas sobre párrafos largos.

## Reglas de trabajo

- Trabajar por fases pequeñas.
- Antes de cambios grandes, explicar brevemente el plan.
- No reescribir archivos completos si no es necesario.
- Mantener código limpio, tipado y escalable.
- Separar lógica de negocio (server/services/), validación (server/schemas/) y UI (/components).
- Usar Zod para validar formularios y APIs.
- Usar Prisma para acceso a base de datos.
- Usar componentes reutilizables — preferir primitivos de /components/ui-v2/.
- Pensar mobile first.
- Montos sensibles siempre con `<SensitiveAmount>`.
- Fechas con timezone Argentina siempre desde `lib/dates.ts`.
- Formularios flotantes/panel siempre con `AppFormPanel` de `components/app/mobile-form.tsx`.

## Regla clave de negocio

La app diferencia entre:

- Dinero ingresado (INCOME)
- Gasto real (EXPENSE)
- Dinero reservado (presupuestos activos)
- Obligaciones (recurrentes + metas + deudas)
- Disponible real = ingresos − gastos − reservado − obligaciones

Esta fórmula vive en `server/services/financial-ledger.ts` y `server/services/dashboard.ts`. No recalcular en UI.

## Módulos MVP implementados

1. Autenticación (Supabase Auth, login, registro, recuperación, onboarding)
2. Dashboard financiero (resumen mensual, IA copilot, reflexión semanal)
3. Transacciones (CRUD completo, filtros, exportación, Smart Import)
4. Categorías (CRUD con categoría padre)
5. Presupuesto mensual (por categoría, alertas de exceso)
6. Gastos recurrentes personales
7. Metas financieras (con progreso)
8. Deudas y pagos
9. Reportes básicos
10. Smart Import (importación IA desde PDF/CSV/imagen)
11. Hogar (gastos compartidos, balances, settlements, pagos recurrentes del hogar)
12. Notificaciones / Activity center

## Lo que NO construir todavía

- Inversiones / activos financieros
- Conversión multi-moneda automática
- Open Banking / scraping bancario
- App nativa móvil
