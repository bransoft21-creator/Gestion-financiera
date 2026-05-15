import type { TxType } from "./types";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileSizeBucket(bytes: number): string {
  if (bytes < 500 * 1024) return "under_500kb";
  if (bytes < 2 * 1024 * 1024) return "under_2mb";
  if (bytes < 5 * 1024 * 1024) return "under_5mb";
  return "large";
}

export function typeLabel(type: TxType): string {
  switch (type) {
    case "INCOME":
      return "Ingreso";
    case "TRANSFER":
      return "Transferencia";
    default:
      return "Gasto";
  }
}

export function typeBadgeClass(type: TxType): string {
  switch (type) {
    case "INCOME":
      return "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "TRANSFER":
      return "border border-blue-400/20 bg-blue-400/10 text-blue-300";
    default:
      return "border border-rose-400/20 bg-rose-400/10 text-rose-300";
  }
}

export function sourceTypeLabel(t: string): string {
  switch (t) {
    case "CARD_SUMMARY":
      return "Resumen de tarjeta";
    case "BANK":
      return "Extracto bancario";
    case "MERCADO_PAGO":
      return "Mercado Pago";
    case "TICKET":
      return "Ticket";
    case "RECEIPT":
      return "Comprobante";
    default:
      return "Documento detectado";
  }
}
