export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";
const ARGENTINA_UTC_OFFSET_HOURS = 3;
const DAY_MS = 86_400_000;

export function parseDateOnly(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const [, year, month, day] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
  };
}

export function transactionDateFromInput(value: unknown) {
  const parsed = parseDateOnly(value);

  if (!parsed) {
    return undefined;
  }

  if (parsed instanceof Date) {
    return parsed;
  }

  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12));
}

export function argentinaDayStartFromInput(value: unknown) {
  const parsed = parseDateOnly(value);

  if (!parsed) {
    return undefined;
  }

  if (parsed instanceof Date) {
    return parsed;
  }

  return argentinaDayStartUtc(parsed.year, parsed.month, parsed.day);
}

export function nextArgentinaDayStart(date: Date) {
  return new Date(date.getTime() + DAY_MS);
}

export function argentinaMonthRangeUtc(year: number, month: number) {
  return {
    start: argentinaMonthStartUtc(year, month - 1),
    end: argentinaMonthStartUtc(year, month),
  };
}

export function argentinaMonthStartUtc(year: number, zeroBasedMonth: number) {
  return new Date(Date.UTC(year, zeroBasedMonth, 1, ARGENTINA_UTC_OFFSET_HOURS));
}

export function formatArgentinaDateInput(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ARGENTINA_TIME_ZONE,
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function argentinaDayStartUtc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, ARGENTINA_UTC_OFFSET_HOURS));
}

export function argentinaMonthKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

export function argentinaMonthParts(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
  };
}

export function argentinaDayMonthYear(date: Date): { day: number; month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}
