# Meridian — Contexto para Claude Code

## Qué es este proyecto

**Meridian** es una aplicación web de finanzas personales y familiares. No es un simple tracker de gastos: calcula el **disponible real** (ingresos − gastos − reservas − obligaciones) y usa IA (OpenAI) para generar contexto financiero accionable.

Nombre interno del proyecto en package.json: `finance-control` (legacy, no actualizar).
Nombre público y en UI: **Meridian**.

---

## Stack real (verificado)

- **Next.js 16** App Router + TypeScript
- **Tailwind CSS** + shadcn/ui + Design System V2 propio (`/components/ui-v2`)
- **Prisma 7** + PostgreSQL via Supabase
- **Supabase Auth**
- **React Hook Form** + `@hookform/resolvers` + **Zod**
- **Recharts** para gráficos
- **OpenAI API** (llamadas HTTP directas, no SDK wrapper)
- **Upstash Redis** para rate limiting (`@upstash/ratelimit`, `@upstash/redis`)
- **Sentry** para error tracking
- **Framer Motion** para animaciones
- **Sonner** para toasts

**NO instalado:** TanStack Query (no usar, hacer fetch directo con `useEffect` o Server Components).

---

## Estructura de carpetas

```
/app/(private)/       — Rutas protegidas (dashboard, transactions, household, etc.)
/app/api/             — API routes (REST, sin TanStack Query en client)
/components/          — UI por dominio:
  /app/               — Shell, nav, modales compartidos
  /ui/                — shadcn/ui base
  /ui-v2/             — Primitivos V2 (PremiumCard, etc.) ← usar estos
  /dashboard/         — Componentes del dashboard (modularizados)
  /household/         — Componentes del hogar
  /finance/           — Componentes financieros
  /copilot/           — IA/copilot
  /layout/            — Layouts de página
/server/services/     — Lógica de dominio (NO mezclar con UI)
/server/schemas/      — Validación Zod para APIs
/hooks/               — Hooks compartidos
/lib/                 — Utilidades (dates.ts, prisma.ts, feature-flags.ts, etc.)
/prisma/              — Schema, migraciones, seed
/docs/                — Documentación
```

**No existe `/features/`** — esa carpeta fue planeada pero nunca creada. La lógica de dominio vive en `/server/services/`.

---

## Patrones de implementación

### API routes
```typescript
// Patrón estándar de API route
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(); // server/auth/current-user.ts
    const data = await someService(user.id);
    return Response.json({ data });
  } catch (error) {
    return handleApiError(error); // server/api/errors.ts
  }
}
```

### Validación
```typescript
// Siempre validar con Zod en el servidor
const parsed = schema.safeParse(await request.json());
if (!parsed.success) return Response.json({ error: "..." }, { status: 400 });
```

### Componentes client-side con fetch
```typescript
// Patrón: fetch directo, sin TanStack Query
const [data, setData] = useState(null);
useEffect(() => {
  fetch("/api/...").then(r => r.json()).then(p => setData(p.data));
}, []);
```

### Design system — usar V2
```typescript
// Preferir PremiumCard sobre Card genérica en pantallas premium
import { PremiumCard, PremiumCardContent, PremiumCardHeader, PremiumCardTitle } from "@/components/ui-v2/premium-card";
```

### Formularios móviles (sheet/drawer/panel)
```typescript
// Para cualquier form que se abra como panel flotante
import { AppFormPanel, appFormContentClass, appFormActionsClass } from "@/components/app/mobile-form";
```

### Montos sensibles (privacy mode)
```typescript
// SIEMPRE wrappear montos con SensitiveAmount
import { SensitiveAmount } from "@/components/app/sensitive-amount";
<SensitiveAmount value={formatMoney(amount)} />
```

### Fechas con timezone Argentina
```typescript
// Usar utilidades de lib/dates.ts — NO crear nuevas funciones ad-hoc
import { argentinaMonthKey, argentinaMonthParts, argentinaDayMonthYear } from "@/lib/dates";
```

---

## Módulos y sus archivos clave

### Dashboard
- `app/(private)/dashboard/dashboard-client.tsx` — orquestador (~415 líneas)
- `app/(private)/dashboard/types.ts` — tipos del módulo
- `app/(private)/dashboard/utils.ts` — formatters, lógica pura
- `components/dashboard/` — 11 componentes extraídos
- `server/services/dashboard.ts` — lógica de negocio del dashboard

### Transacciones
- `app/(private)/transactions/transactions-client.tsx` — cliente principal
- `server/services/transactions.ts` — CRUD completo con ledger integrado
- `server/schemas/transactions.ts` — validación Zod

### Smart Import
- `app/(private)/smart-import/smart-import-client.tsx`
- `app/api/ai/smart-import/` — pipeline de IA (parse → candidates → import)

### Hogar
- `app/(private)/household/household-client.tsx` — ~971 líneas
- `app/(private)/household/types.ts` — tipos del módulo
- `app/(private)/household/utils.ts` — helpers UI
- `components/household/payment-row.tsx` — componente extraído
- `server/services/households.ts` — balance, briefing, settlements
- `server/services/recurring-payments.ts` — pagos recurrentes compartidos

### Feature flags
- `lib/feature-flags.ts` — `isAiEnabled`, `isSmartImportEnabled`, `isMaintenanceModeEnabled`

---

## Reglas financieras críticas (NO cambiar sin consenso)

La fórmula del **disponible real** es:
```
Disponible real = Ingresos − Gastos − Reservado − Obligaciones
```

donde:
- **Reservado** = suma de `max(presupuesto planificado − gasto real de categoría, 0)`
- **Obligaciones** = recurrentes vencidos + aportes a metas + pagos de deuda vencidos

Esta lógica vive en `server/services/financial-ledger.ts` y `server/services/dashboard.ts`. No recalcular en UI.

Efectos de transacciones en saldo de cuenta:
- `INCOME`, `ADJUSTMENT` → aumentan cuenta
- `EXPENSE`, `DEBT_PAYMENT`, `GOAL_CONTRIBUTION`, `INVESTMENT` → reducen cuenta
- `TRANSFER` → reduce origen, aumenta destino

---

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Clave anónima Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Clave service-role (solo server) |
| `DATABASE_URL` | ✅ | Connection string PostgreSQL (pooled) |
| `DIRECT_URL` | ✅ | Connection string directa (migraciones) |
| `NEXT_PUBLIC_APP_URL` | ✅ | URL base de la app |
| `OPENAI_API_KEY` | ✅ | Para análisis IA y Smart Import |
| `UPSTASH_REDIS_REST_URL` | prod | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | prod | Rate limiting |
| `SENTRY_DSN` | prod | Error tracking |
| `NEXT_PUBLIC_SENTRY_DSN` | prod | Error tracking client-side |
| `DISABLE_AI` | op | `1` deshabilita IA completa |
| `DISABLE_SMART_IMPORT` | op | `1` deshabilita solo Smart Import |
| `BETA_ALLOWLIST_EMAILS` | op | Emails separados por coma (vacío = libre) |
| `MAINTENANCE_MODE` | op | `1` devuelve 503 |
| `ENABLE_PWA` | op | `1` habilita PWA (deshabilitada por defecto) |

---

## Lo que NO está en scope aún

- Inversiones / activos de inversión
- Conversión automática multi-moneda (ARS ↔ USD)
- Integración con bancos (Open Banking / scraping)
- App nativa móvil (React Native / Expo)
- Features en tiempo real (WebSockets)
- Marketplace o plugins

No iniciar ninguno de estos sin decisión explícita del producto.

---

## Comandos útiles

```bash
npm run dev            # Dev server
npm run build          # Build producción
npm run lint           # ESLint
npm run test           # Tests
npx tsc --noEmit       # Type check
npm run db:migrate     # Migraciones Prisma
npm run db:seed        # Seed base
npm run db:studio      # Prisma Studio
```

---

## Estado post-Stabilization Phase (Mayo 2026)

| Módulo | Estado |
|--------|--------|
| Smart Import | ✅ Modularizado y estable |
| Transactions | ✅ Modularizado y estable |
| Dashboard | ✅ Modularizado (1666 → 415 líneas) |
| Household | ✅ Estabilizado, fecha logic consolidada |
| Design System V2 | ✅ Implementado (PremiumCard, tokens, etc.) |
| PWA | ⏸ Deshabilitada en beta (intencional) |
| Inversiones | ❌ No implementado |
