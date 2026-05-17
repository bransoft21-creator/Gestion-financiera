# Meridian Activation System - Phase 3

## 1. Diagnostico realista del problema Excel

En LATAM el Excel financiero personal suele ser una mezcla pragmatica, no contable:

- Una hoja por mes, tarjeta o cuenta.
- Columnas comunes: fecha, concepto, monto, categoria, cuenta, moneda, debe/haber.
- Montos con formatos locales: `$ 1.234,56`, `1,234.56`, negativos, o egreso/ingreso separados.
- Categorias escritas a mano y distintas entre meses.
- ARS como default, USD en columnas puntuales o en textos como `U$S`.
- Muchos usuarios tienen 1 a 3 meses utiles, no historiales limpios de anos.

Lo que genera abandono:

- Empezar desde cero.
- Pedir mapeo manual largo.
- Importar en silencio sin preview.
- Errores de moneda o signo.
- Que la app parezca "contable" o enterprise.

## 2. MVP exacto

Soportado:

- CSV.
- XLSX con una hoja.
- Hasta 10 MB por archivo.
- Hasta 500 filas importables.
- Recomendacion UX: ultimos 3 meses.
- Hasta 5 analisis exitosos por hogar por dia.

No soportado en MVP:

- Multiples hojas.
- Macros, formulas complejas o tablas dinamicas.
- Archivos enterprise con cientos de columnas.
- Importacion automatica sin revision humana.

## 3. Pipeline completo

1. Upload mobile-first.
2. Validacion de formato y tamano.
3. Parse backend:
   - CSV: parser deterministico con delimitador `,`, `;` o tab.
   - XLSX: lectura de una hoja y shared strings.
4. Deteccion de header en primeras 10 filas.
5. Mapping deterministico:
   - fecha
   - descripcion/concepto
   - monto o debe/haber
   - moneda
   - categoria
   - cuenta/metodo
6. Normalizacion LATAM:
   - fechas `DD/MM/YYYY`, `YYYY-MM-DD`, serial Excel.
   - importes ARS/USD con coma o punto decimal.
7. Sugerencias:
   - categoria por columna o reglas de merchants LATAM.
   - cuenta por moneda/metodo.
8. Deteccion de duplicados.
9. Preview editable.
10. Confirmacion explicita.
11. Creacion de transacciones seleccionadas.

## 4. Uso correcto de IA

En el camino feliz CSV/XLSX no se usa IA.

La IA queda permitida solo para:

- PDFs, imagenes o tickets.
- Mapping ambiguo futuro con sample reducido.
- Sugerir categorias cuando reglas deterministicas no alcanzan.

Reglas:

- No mandar 500 filas completas a OpenAI.
- No modificar montos.
- No inventar movimientos.
- No categorizar silenciosamente.
- No importar automaticamente.

Fallback sin IA:

- CSV/XLSX siguen funcionando con parser deterministico.
- Si mapping falla, el usuario recibe copy claro para renombrar columnas basicas.

## 5. Limites definidos

- Max archivo: 10 MB.
- Max filas: 500.
- Max hojas XLSX: 1.
- Max analisis diarios por hogar: 5.
- Timeout cliente: 90 segundos.
- Preview obligatorio siempre.

Si se supera:

- 500 filas: "Este MVP acepta hasta 500 filas por importacion. Proba subir los ultimos 3 meses o dividir el archivo."
- multiples hojas: "Deja solo la hoja de movimientos y volve a subirlo."
- mapping insuficiente: "Renombra columnas como Fecha, Concepto e Importe."

## 6. UX flow completo

1. Entrada: "Subi tu Excel o comprobante."
2. Dropzone acepta CSV, XLSX, PDF e imagenes.
3. File preview con limite visible.
4. Processing calmado:
   - leyendo archivo
   - detectando columnas
   - identificando importes
   - preparando categorias
   - verificando duplicados
5. Preview editable:
   - seleccionado por defecto salvo duplicados.
   - warnings por fila cuando fecha o mapping no es claro.
   - usuario puede corregir cuenta, categoria, tipo, fecha, descripcion y monto.
6. Confirmacion.
7. Done state con importadas, descartadas, duplicados evitados y tiempo estimado ahorrado.

## 7. Riesgos

- Moneda ambigua en archivos mixtos.
- Signo invertido en exports bancarios.
- XLSX con formulas o varias hojas.
- Usuarios intentando subir historiales enormes.
- Confianza rota si se guarda algo sin preview.

Mitigaciones:

- Preview obligatorio.
- Moneda editable por fila en siguiente iteracion.
- Limite 500 filas.
- Copy claro y no culpabilizante.
- Duplicados deseleccionados por defecto.

## 8. Costos estimados

CSV/XLSX:

- Costo IA: 0.
- Costo backend: bajo, parse de archivo y normalizacion.

PDF/imagen:

- Mantiene cuota IA existente.
- Max 5 analisis exitosos por hogar por dia reduce abuso.
- Cache por hash evita reprocesar archivos repetidos.

## 9. Que NO hacer

- No construir un wizard enterprise de mapeo.
- No procesar todas las hojas.
- No importar sin preview.
- No usar IA para leer todo un CSV.
- No prometer exactitud contable.
- No ocultar warnings.
- No bloquear al usuario por categorias desconocidas.

## 10. Readiness para beta

Listo para beta si:

- CSV simple importa con fecha, concepto e importe.
- XLSX de una hoja importa con el mismo flujo.
- Archivos de mas de 500 filas muestran error claro.
- Archivos con varias hojas muestran error claro.
- Preview se abre antes de guardar.
- `npm run lint`, `npm run build` y `npm test` pasan.
- Telemetria no envia filas completas, merchants ni montos.
