# Meridian Retention System - Phase 2C

## 1. Filosofia

Regla principal: **Meridian solo interrumpe cuando realmente puede aportar claridad.**

Principios:

- Claridad sobre frecuencia: si una senal no cambia una decision, no se notifica.
- Sin culpa: no usamos lenguaje de fallo, deuda moral, castigo ni miedo.
- Sin engagement artificial: no hay streaks, "volve a la app", urgency falsa ni DAU chasing.
- Menos es mas: el default es guardar la senal en Activity Center; push solo para situaciones accionables y elegidas.
- Lectura no es resolucion: ver una senal apaga el badge, pero la senal sigue pendiente hasta resolverse, archivarse o expirar.
- LATAM-aware: contemplar inflacion, pagos concentrados, cierres de tarjeta, cuotas, transferencias y hogares compartidos sin dramatizar.

## 2. Categorias definitivas

| Categoria | Se notifica | Prioridad | Frecuencia |
| --- | --- | --- | --- |
| Weekly Pulse | Si, cuando esta listo y hay datos | Baja/media si warning | 1 por semana |
| Monthly Close | Si, cuando hay cierre del mes anterior | Baja/media si warning | 1 por mes |
| Upcoming obligations | Si, pagos recurrentes proximos | Media | Agrupado, max 1 por semana |
| Household reminders | Si, solo pagos compartidos o settlements accionables | Media | Agrupado |
| Smart Import follow-up | Si, cuando queda revision incompleta | Baja | Max 1 follow-up por importacion |
| Stability/progress signals | Si, dentro del centro; push no | Baja | Agrupado en Weekly Pulse |
| Data quality / uncategorized | Si, cuando afecta insights | Baja/media | Agrupado |
| FX reminders | No por defecto | Opt-in | Solo si el usuario configura USD/ARS |

No entran en v2: streaks, score financiero, comparaciones sociales, "gastaste demasiado", alertas constantes por cada movimiento, badges por mensajes positivos ya vistos.

## 3. Que interrumpe y que no

Interrumpe:

- Un cierre semanal o mensual ya preparado.
- Un pago u obligacion proxima con ventana razonable.
- Datos sin categorizar que degradan insights importantes.
- Un seguimiento de importacion cuando el usuario dejo una accion empezada.

No interrumpe:

- Variaciones menores de gasto.
- "Todo va bien" repetido.
- Montos individuales, merchants o movimientos sensibles.
- Senales que solo buscan abrir la app.
- Recordatorios de deuda sin vencimiento o accion concreta.

## 4. Emotional UX

Tono:

- Calmo, concreto, no paternalista.
- Evitar segunda persona acusatoria cuando hay riesgo financiero.
- Nombrar contexto antes que juicio.
- Usar "revisar", "visible", "contexto", "cuando tengas un minuto".

Color:

- Neutral: zinc/muted para informacion.
- Positive: teal suave, nunca celebracion excesiva.
- Warning: amber suave solo si hay accion o vencimiento.
- Evitar rojo agresivo salvo error tecnico o bloqueo real.

Warnings:

- Warning se usa para vencimiento, presupuesto excedido o dato que afecte decisiones.
- No se usa warning para "subio el gasto" si puede ser un pago fijo o tarjeta.

## 5. Wording examples

- "Tu Weekly Pulse esta listo."
- "Tu cierre de mes esta disponible."
- "Hay pagos proximos."
- "Hay movimientos sin categorizar que podrian afectar tus insights."
- "El mes viene con margen."
- "El flujo reciente estuvo mas activo."
- "Ya pasaron los gastos mas pesados del mes."

Evitar:

- "Gastaste demasiado."
- "Tu score bajo."
- "Urgente."
- "No pierdas tu racha."
- "Abri la app ahora."

## 6. Activity Center

El Activity Center es la fuente de verdad. La campana lee `ActivityItem` persistente y deja de crear alertas paralelas desde `localStorage`.

Cambios v2:

- Badge = `unreadCount` persistente.
- Pendiente = `resolvedAt === null`, independiente de `readAt`.
- Abrir/ver el centro marca como leidas las senales visibles despues de un breve delay.
- Archivar oculta del feed principal.
- Resolver marca como resuelto y leido.
- Expiracion automatica para senales semanales viejas, positivos viejos y recordatorios mensuales no criticos de meses anteriores.

## 7. Badge / unread logic

- `readAt = null`: aun no visto, cuenta badge.
- `readAt != null`: visto, no cuenta badge.
- `resolvedAt = null`: puede seguir apareciendo como pendiente aunque ya no tenga badge.
- `dismissedAt != null`: no aparece en feed principal.
- Ver el centro apaga el badge; no fuerza resolucion.

## 8. Frecuencia

- Weekly Pulse: max 1/semana.
- Monthly Close: max 1/mes.
- Obligaciones: agrupadas, max 1/semana salvo vencimiento.
- Data quality: agrupada, max 1 cada 7 dias.
- Smart Import: max 1 follow-up por lote incompleto.
- Push: opt-in, solo para prioridad media/alta y nunca para positivos.

## 9. Telemetria

Eventos minimos:

- `notification_received`
- `notification_opened`
- `notification_dismissed`
- `pulse_notification_opened`
- `monthly_close_notification_opened`

Propiedades permitidas: `count`, `type`, `tone`, `priority`, `area`. No se envian montos, merchants, nombres de cuentas, categorias libres ni informacion sensible.

## 10. Riesgos

- Fatiga por duplicacion entre dashboard y Activity Center.
- Badge persistente si lectura y pendiente se mezclan.
- Ansiedad si el copy suena a juicio.
- Push prematuro en iOS/Android antes de demostrar valor dentro de la app.
- Senales viejas que quedan como deuda visual.

## 11. Que no hacer

- No optimizar DAU artificialmente.
- No crear streaks.
- No usar rojo para variaciones normales.
- No empujar "todo bien" como push.
- No avisar cada movimiento.
- No mostrar montos sensibles en telemetria.
- No usar score financiero punitivo.

## 12. Readiness para beta

Listo para beta si:

- Badge desaparece al ver el centro.
- Pendientes siguen visibles hasta resolver, archivar o expirar.
- Weekly Pulse y Monthly Close crean una sola senal por periodo.
- No hay notificaciones paralelas generadas en cliente.
- Telemetria no contiene montos ni merchants.
- Mobile header y pagina `/notifications` funcionan en Safari iPhone y Chrome Android.
- Copy de warning se mantiene contextual y no acusatorio.
