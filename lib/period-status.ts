import { formatArgentinaDateInput } from "@/lib/dates";

export type PeriodStatus = "OPEN" | "CLOSED" | "FUTURE";

export interface PeriodContext {
  status: PeriodStatus;
  year: number;
  month: number;
  statusLabel: string;
  dayOfMonth?: number;
  daysRemaining?: number;
  daysInMonth?: number;
  completionPercent?: number;
}

export function getPeriodStatus(year: number, month: number): PeriodStatus {
  const dateStr = formatArgentinaDateInput();
  const [currentYear, currentMonth] = dateStr.split("-").map(Number);
  if (year === currentYear && month === currentMonth) return "OPEN";
  if (year > currentYear || (year === currentYear && month > currentMonth)) return "FUTURE";
  return "CLOSED";
}

export function buildPeriodContext(year: number, month: number): PeriodContext {
  const status = getPeriodStatus(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();

  const statusLabel =
    status === "OPEN" ? "en curso" : status === "CLOSED" ? "cerrado" : "próximo";

  if (status === "OPEN") {
    const dateStr = formatArgentinaDateInput();
    const dayOfMonth = Number(dateStr.split("-")[2]);
    const daysRemaining = daysInMonth - dayOfMonth;
    const completionPercent = Math.round((dayOfMonth / daysInMonth) * 100);
    return { status, year, month, statusLabel, dayOfMonth, daysRemaining, daysInMonth, completionPercent };
  }

  return { status, year, month, statusLabel, daysInMonth };
}
