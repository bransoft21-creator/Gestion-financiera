export const PROCESSING_STEPS = [
  "Leyendo el documento…",
  "Detectando comercios…",
  "Identificando importes…",
  "Clasificando movimientos…",
  "Verificando duplicados…",
  "Preparando resultados…",
];

export const SMART_IMPORT_TIMEOUT_MS = 90_000;
export const SMART_IMPORT_SLOW_MS = 12_000;

export const SMART_IMPORT_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
