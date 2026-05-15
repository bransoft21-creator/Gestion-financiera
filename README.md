# Meridian

**Tu dinero, con perspectiva.**

Meridian es una aplicación web de finanzas personales y familiares que va más allá de registrar ingresos y gastos. Calcula el disponible real considerando reservas, obligaciones y compromisos futuros, y usa IA para generar contexto financiero accionable.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 App Router + TypeScript |
| UI | Tailwind CSS + shadcn/ui + Design System V2 propio |
| Base de datos | PostgreSQL via Supabase + Prisma ORM |
| Auth | Supabase Auth |
| Formularios | React Hook Form + Zod |
| Charts | Recharts |
| IA | OpenAI API (análisis mensual, reflexión semanal, Smart Import) |
| Rate limiting | Upstash Redis |
| Error tracking | Sentry |
| PWA | @ducanh2912/next-pwa (deshabilitado por defecto en beta) |

---

## Setup rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env.local
# → Completar con credenciales reales (ver sección Variables de entorno)

# 3. Aplicar migraciones de base de datos
npm run db:migrate

# 4. Sembrar categorías base (solo primera vez)
npm run db:seed

# 5. Iniciar en desarrollo
npm run dev
```

---

## Comandos

```bash
npm run dev          # Servidor de desarrollo (localhost:3000)
npm run build        # Build de producción
npm run lint         # ESLint
npm run test         # Tests
npm run db:migrate   # Aplicar migraciones Prisma
npm run db:seed      # Sembrar datos base
npm run db:studio    # Prisma Studio (explorador visual de DB)
npx tsc --noEmit     # TypeScript check sin compilar
```

---

## Variables de entorno

Ver `.env.example` para la lista completa. Variables obligatorias:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Base de datos
DATABASE_URL=
DIRECT_URL=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# OpenAI (requerido para IA y Smart Import)
OPENAI_API_KEY=

# Upstash Redis (requerido para rate limiting en producción)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Variables opcionales de operación:

```bash
DISABLE_AI=1                    # Deshabilita todos los endpoints de IA
DISABLE_SMART_IMPORT=1          # Deshabilita Smart Import sin deshabilitar IA
BETA_ALLOWLIST_EMAILS=          # Lista de emails separados por coma (vacío = acceso libre)
MAINTENANCE_MODE=1              # Devuelve 503 en todas las rutas
ENABLE_PWA=1                    # Habilita PWA (deshabilitada por defecto en beta)
```

---

## Arquitectura

```
/app                    — Next.js App Router (rutas, layouts, páginas)
  /(private)            — Rutas protegidas (requieren auth)
  /api                  — API routes (REST endpoints)
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
/lib                    — Utilidades (dates, prisma, supabase, feature-flags)
/prisma                 — Schema, migraciones, seed
/design-system          — Tokens y principios del Design System V2
/docs                   — Documentación del proyecto
/tests                  — Tests automatizados
```

---

## Módulos implementados

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| Auth | ✅ | Login, registro, recuperación, onboarding |
| Dashboard | ✅ | Resumen mensual, IA copilot, reflexión semanal |
| Transacciones | ✅ | CRUD completo, filtros, exportación, Smart Import |
| Categorías | ✅ | CRUD con categoría padre opcional |
| Presupuestos | ✅ | Presupuestos mensuales por categoría |
| Gastos recurrentes | ✅ | Recurrentes personales (toggle, próximos) |
| Metas | ✅ | Metas de ahorro con progreso |
| Deudas | ✅ | Gestión de deudas y pagos |
| Reportes | ✅ | Análisis mensual con Recharts |
| Smart Import | ✅ | Importación IA desde PDF/CSV/imagen |
| Hogar | ✅ | Gastos compartidos, balances, settlements |
| Notificaciones | ✅ | Activity center, señales financieras |
| Perfil | ✅ | Gestión de cuenta y preferencias |

---

## Módulos no implementados (próximos)

- Inversiones
- Conversión multi-moneda automática
- Integración con bancos (Open Banking)
- App nativa móvil

---

## Documentación adicional

| Documento | Descripción |
|-----------|-------------|
| `docs/ARCHITECTURE.md` | Estructura técnica y reglas de implementación |
| `docs/FINANCIAL_FORMULAS.md` | Fórmulas financieras oficiales (disponible real, tasa de ahorro, etc.) |
| `docs/TODO.md` | Roadmap y estado de cada módulo |
| `docs/PWA_AUDIT.md` | Estado y decisiones sobre PWA |
| `docs/BETA_OPERABILITY_CHECKLIST.md` | Checklist de operación en beta |
| `docs/LAUNCH_SAFETY_CHECKLIST.md` | Checklist de seguridad pre-lanzamiento |
| `CLAUDE.md` | Contexto y guías para desarrollo con Claude Code |
