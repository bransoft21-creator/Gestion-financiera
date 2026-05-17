# Meridian Smart Import - Phase 3A

## 1. Filosofia IA de Meridian

Principio central:

- Deterministico = fuente de verdad.
- IA = asistente contextual.

La IA no importa, no confirma, no crea movimientos, no corrige montos y no actua en silencio. Solo sugiere mapping cuando la estructura del archivo es ambigua y deja una explicacion breve en el preview.

## 2. Confidence system

Scoring de estructura:

- fecha detectada: +0.25
- descripcion/concepto detectado: +0.25
- monto unico detectado: +0.25
- debe/haber detectado: +0.18
- moneda/categoria/cuenta/metodo: bonus pequeno
- headers ambiguos como `imp`, `mov`, `det`, `mto`: penalizacion suave

Thresholds:

- `>= 0.90`: deterministic only.
- `0.60 - 0.89`: deterministic + soft warnings.
- `< 0.60`: invocar IA contextual.

Fallback:

- Si IA no esta disponible, no hay cuota o hay timeout, se vuelve al mapping deterministico.
- Si aun faltan fecha, concepto e importe/debe-haber, se muestra error claro para renombrar columnas.

## 3. Casos donde IA si ayuda

- Headers raros: `Imp`, `Mov`, `Det`, `Oper`.
- Archivos con columnas semi-desordenadas.
- Distinguir `monto` vs `debe/haber` cuando los nombres no son obvios.
- Detectar columna de moneda si el nombre no coincide.
- Explicar por que una estructura necesita revision.

## 4. Casos donde IA NO debe intervenir

- CSV/XLSX con headers claros.
- Importes, fechas y conceptos ya detectados con alta confianza.
- Procesar cientos de filas.
- Corregir montos.
- Inferir balances.
- Crear movimientos faltantes.
- Categorizar silenciosamente sin preview.

## 5. Arquitectura completa

1. Parse deterministico CSV/XLSX.
2. Deteccion de header en primeras 10 filas.
3. Mapping deterministico.
4. Confidence scoring.
5. IA contextual solo si confidence `< 0.60`.
6. IA recibe headers + perfiles estadisticos, no filas completas.
7. Sanitizacion: la IA solo puede elegir nombres de columnas existentes.
8. Normalizacion deterministica de filas.
9. Preview editable con explicacion.
10. Confirmacion humana.
11. Import final.

## 6. Cost strategy

Limites:

- Payload maximo: JSON truncado a 6 KB.
- Perfiles de hasta 20 filas, sin valores crudos.
- Timeout: 12 segundos.
- Output maximo: 700 tokens.
- Endpoint separado: `ai.smart-import.mapping`.
- Limite diario default: 5 llamadas por usuario.

Costo esperado:

- Camino feliz CSV/XLSX: USD 0.
- Mapping ambiguo: una llamada chica, normalmente menos de 1K tokens.
- PDF/imagen mantiene el flujo IA existente y sus cuotas.

## 7. Prompt strategy

Prompt corto y deterministico:

- Define rol: capa contextual de mapping.
- Repite limites: no procesar filas, no inventar movimientos, no corregir montos.
- Pide JSON estricto.
- Campos: `confidence`, `reasoning`, `mapping`, `warnings`.

No hay texto conversacional largo. El reasoning se recorta y se muestra como contexto, no como autoridad.

## 8. UX / trust guidelines

Mostrar:

- "IA contextual ayudo con el mapping" solo si se uso.
- Confianza de estructura en porcentaje.
- Reasoning breve.
- Preview editable siempre.

No mostrar:

- "Listo" como si fuera infalible.
- Celebracion excesiva.
- Copys de certeza cuando confidence es media o baja.

## 9. Riesgos

- Usuario confia demasiado en una sugerencia IA.
- Headers ambiguos mal mapeados.
- Fallback por falta de cuota confundiendo al usuario.
- Costo si muchos usuarios suben archivos rotos.

Mitigaciones:

- IA solo bajo 0.60.
- Sanitizacion contra headers existentes.
- Preview obligatorio.
- Telemetria de accepted/rejected.
- Limites diarios y timeout corto.

## 10. Que NO hacer

- No mandar 500 filas a OpenAI.
- No enviar merchants o montos crudos para mapping.
- No permitir que IA escriba transacciones.
- No ocultar que IA participo.
- No convertir Smart Import en un mapeador enterprise.

## 11. Readiness para beta

Listo para beta si:

- Archivos claros no invocan IA.
- Archivos ambiguos invocan IA solo para mapping.
- Fallback sin IA no rompe el flujo.
- El preview muestra confianza y razon breve.
- Telemetria incluye invoked, suggested, accepted, rejected y fallback.
- `npm run lint`, `npm run build` y `npm test` pasan.
