# TODO — Estado Real de Meridian

Estado actualizado post-Stabilization Phase (mayo 2026). Los módulos MVP están implementados. Este archivo registra el estado real, no el roadmap original.

## Módulos Implementados (MVP Completo)

| Módulo | Estado | Notas |
|--------|--------|-------|
| Auth | ✅ | Login, registro, recuperación, onboarding |
| Dashboard | ✅ | Resumen mensual, IA copilot, reflexión semanal, health signals |
| Transacciones | ✅ | CRUD completo, filtros, exportación CSV, Smart Import |
| Categorías | ✅ | CRUD con categoría padre opcional |
| Presupuestos | ✅ | Por categoría, alertas visuales de exceso |
| Gastos recurrentes | ✅ | Toggle activo/pausado, próximos pagos |
| Metas | ✅ | Progreso, aportes, fecha objetivo |
| Deudas | ✅ | Gestión de deudas y pagos |
| Reportes | ✅ | Análisis mensual con Recharts |
| Smart Import | ✅ | Importación IA desde PDF/CSV/imagen |
| Hogar | ✅ | Gastos compartidos, balances, settlements, recurrentes del hogar |
| Notificaciones | ✅ | Activity center, señales financieras |
| Perfil | ✅ | Gestión de cuenta y preferencias |

## Deuda Técnica Resuelta

| Área | Qué se hizo |
|------|-------------|
| Dashboard | Modularizado de 1666 → 415 líneas; hook useCountUp canonicalizado |
| Household | Tipos, utils y PaymentRow extraídos; fechas Argentina consolidadas en lib/dates.ts |
| Smart Import | Estabilizado: parsing, validación, UI de revisión |
| Transactions | Estabilizado: import flow, filtros, exportación |

## Próximos Módulos (No Construir Todavía)

Estos módulos están fuera de scope hasta decisión explícita:

- **Inversiones / activos financieros** — requiere modelo de datos separado y UX de portafolio
- **Conversión multi-moneda automática** — requiere API de tipo de cambio confiable
- **Open Banking / scraping bancario** — requiere integración por banco, compliance complejo
- **App nativa móvil** — PWA cubre el caso de uso actual

## Backlog de Mejoras (Priorizables)

Mejoras concretas sobre módulos existentes, en orden de impacto estimado:

### Dashboard
- [ ] Persistir periodo seleccionado (no siempre mes actual)
- [ ] Comparativa mes anterior en hero

### Transacciones
- [ ] Búsqueda fulltext en descripción
- [ ] Filtro por cuenta

### Hogar
- [ ] Historial de settlements anteriores
- [ ] Notificación push cuando un miembro registra un pago

### Smart Import
- [ ] Soporte multi-archivo en una sola importación
- [ ] Mejorar detección de categorías desde PDF bancario

### Presupuestos
- [ ] Copiar presupuesto del mes anterior
- [ ] Presupuesto anual con distribución mensual

### Metas
- [ ] Proyección de fecha de cumplimiento según aportes actuales

### Notificaciones
- [ ] Push notifications via web push API

## Notas Operativas

- PWA deshabilitada por defecto en beta (`ENABLE_PWA=1` para activar).
- Rate limiting en endpoints de IA con Upstash Redis.
- Beta allowlist via `BETA_ALLOWLIST_EMAILS` (vacío = acceso libre).
- Sentry activo en producción para error tracking.
