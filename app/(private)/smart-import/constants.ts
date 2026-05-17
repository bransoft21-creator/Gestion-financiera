export const PROCESSING_STEPS = [
  "Leyendo el archivo…",
  "Detectando columnas…",
  "Identificando importes…",
  "Preparando categorías…",
  "Verificando duplicados…",
  "Preparando resultados…",
];

export const SMART_IMPORT_TIMEOUT_MS = 90_000;
export const SMART_IMPORT_SLOW_MS = 12_000;
export const SMART_IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;

export const SMART_IMPORT_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const SMART_IMPORT_ALLOWED_EXTENSIONS = [".csv", ".xlsx"] as const;
