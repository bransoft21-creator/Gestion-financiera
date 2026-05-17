# Meridian Experience System — Phase 5
# Contextual Financial Education

## 1. Filosofia educativa de Meridian

Meridian ensena finanzas dentro del momento de uso, no como curso separado. La regla del sistema es: una explicacion aparece solo cuando puede convertir una senal financiera en claridad accionable.

Principios:
- Contexto antes que contenido: no hay feed, blog ni clases.
- Claridad antes que expertise: explicar con palabras cotidianas.
- Respeto emocional: no usar culpa, miedo, urgencia ni comparaciones sociales.
- Micro aprendizaje: una idea breve por superficie.
- Deterministico primero: las reglas del producto deciden si hay educacion.
- Sin asesoramiento financiero: Meridian explica conceptos, no recomienda inversiones.
- Menos es mas: si no hay una senal clara, no se muestra nada.

## 2. Problemas financieros LATAM prioritarios

- Inflacion y perdida de poder de compra: la gente entiende el saldo nominal, pero no siempre el valor real.
- Multi-moneda cotidiana: ARS/USD y saldos separados requieren contexto sin empujar decisiones.
- Efectivo y billeteras virtuales: el dinero queda repartido y se vuelve dificil ver disponibilidad real.
- Cuotas y tarjetas: el gasto de hoy puede ocupar margen futuro.
- Ingresos variables: el mes no siempre se comporta como una planilla fija.
- Gastos invisibles: delivery, transporte, suscripciones y compras chicas repetidas.
- Obligaciones compartidas: household requiere claridad sin convertir la convivencia en deuda emocional.
- Carga fija: alquiler, servicios, deudas y metas reducen margen antes del gasto variable.

## 3. Diseno completo del sistema

El sistema implementado tiene tres piezas:
- Motor deterministico: `lib/finance/contextual-education.ts`.
- Tarjeta educativa reusable: `components/education/contextual-education-card.tsx`.
- Integraciones: dashboard, Weekly Pulse y Monthly Close.

Flujo:
1. Meridian calcula metricas y senales existentes.
2. El motor educativo detecta si hay una oportunidad real de aprendizaje.
3. Se elige una sola tarjeta por superficie.
4. El usuario puede expandir, guardar u ocultar.
5. La tarjeta expira despues de un periodo definido para evitar repeticion.

## 4. Education surfaces

Incluidas en beta:
- Dashboard: contexto general del mes.
- Weekly Pulse: micro aprendizaje ligado al ritmo semanal.
- Monthly Close: explicacion del cierre y margen mensual.

No incluidas en beta:
- Feed educativo.
- Blog.
- Cursos.
- Push educativo.
- Centro de lecciones.

Superficies futuras posibles:
- Household, solo para balance de gastos compartidos.
- Budgets, solo para margen y carga fija.
- Debt flows, solo para carga financiera y cuotas.
- Smart Import, solo para explicar preview, categorias y moneda.

## 5. Education categories

Beta:
- Margen financiero.
- Carga fija mensual.
- Uso de credito.
- Cuotas.
- Gastos invisibles.
- Estabilidad mensual.
- Estabilidad de valor en contexto inflacionario.

Futuras:
- Household balance.
- Efectivo y billeteras.
- Ingresos variables.

## 6. Language system

Tono:
- Breve.
- Humano.
- Tranquilo.
- Practico.
- Sin superioridad.

Palabras preferidas:
- "margen", "espacio", "contexto", "cierre", "compromisos", "disponible real".

Palabras a evitar:
- "mal", "error", "fracaso", "controlate", "deberias", "urgente", "peligro", "score", "disciplina", "mentalidad".

Traducciones de complejidad:
- No: "liquidez patrimonial".
- Si: "la plata que realmente tenes disponible".
- No: "apalancamiento".
- Si: "compromisos que pasan al proximo cierre".
- No: "erosion monetaria".
- Si: "plata que pierde poder de compra con inflacion".

## 7. Emotional UX

La tarjeta usa:
- Titulo simple.
- Explicacion de una frase.
- Expansion opcional con takeaway.
- Dismiss local con expiracion.
- Guardado local sin crear presion.
- Colores sobrios: neutral, teal positivo, amber moderado.

Warnings:
- Solo se usan cuando el concepto acompana una senal ya relevante.
- Nunca se usa rojo agresivo.
- Nunca se muestra texto de culpa.

Ejemplos implementados:
- "Margen financiero: Es la plata que queda despues de cubrir gastos y compromisos."
- "Uso de credito: La tarjeta puede ordenar pagos, pero concentra compromisos en el proximo cierre."
- "Gastos invisibles: Algunos gastos parecen chicos aislados, pero se vuelven relevantes cuando se repiten."

## 8. Timing/frequency rules

Reglas:
- Maximo una tarjeta por superficie.
- No hay push educativo.
- No hay educacion si no hay senal contextual.
- Dismiss expira entre 14 y 45 dias segun tema.
- Weekly Pulse prioriza patrones semanales.
- Monthly Close prioriza margen, obligaciones y estabilidad.
- Dashboard prioriza disponible real, carga fija, credito, variable spend y multi-moneda.

Cadencia tolerable:
- Dashboard: una tarjeta contextual cuando aplica.
- Weekly Pulse: una tarjeta dentro del sheet si una senal lo justifica.
- Monthly Close: una tarjeta dentro del sheet si el cierre lo justifica.

## 9. Riesgos

- Que el sistema parezca consejo financiero: se mitiga evitando recomendaciones de inversion.
- Que se vuelva repetitivo: se mitiga con dismiss y expiracion.
- Que se sienta moralista: se mitiga con lenguaje neutral y sin culpa.
- Que agregue ruido al dashboard: se mitiga con una sola tarjeta.
- Que IA invente conclusiones: en beta no se usa IA para decidir educacion.
- Que se filtren datos sensibles: telemetria solo envia IDs, surface, category y tone.

## 10. Que NO hacer

- No feed infinito de tips.
- No cursos.
- No gamificacion.
- No streaks.
- No consejos de trading o inversion.
- No "mentalidad de abundancia".
- No notificaciones educativas.
- No mensajes tipo "gastaste demasiado".
- No comparaciones contra otros usuarios.
- No usar IA para inventar diagnosticos financieros.

## 11. Readiness para beta

Estado: listo para beta controlada.

Incluido:
- Motor deterministico.
- Tarjetas mobile-first.
- Expand, save y dismiss local.
- Telemetria minima segura.
- Integracion con dashboard, Weekly Pulse y Monthly Close.
- Tests de seleccion contextual.

Pendiente despues de beta:
- Aprendizajes especificos para household.
- Educacion contextual para budgets y deudas.
- Controles de frecuencia por usuario en backend.
- Biblioteca editorial versionada.
- Evaluacion cualitativa de tono con usuarios LATAM.
