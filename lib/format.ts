export function formatMoney(value: number, currency: "ARS" | "USD" | string = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function formatRelativeDate(value: string): string {
  const diff = Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "hoy";
  if (diff === 1) return "hace 1 día";
  if (diff < 30) return `hace ${diff} días`;
  if (diff < 60) return "hace 1 mes";
  return `hace ${Math.floor(diff / 30)} meses`;
}
