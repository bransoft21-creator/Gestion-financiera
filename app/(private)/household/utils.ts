import type { HouseholdBriefing, HouseholdBriefingStatus, RecurringPaymentsSummary } from "./types";

export function formatMoney(value: number, currency: "ARS" | "USD", hidden = false) {
  if (hidden) return "$••••";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "ARS" ? 0 : 2,
  }).format(value);
}

export function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(dateStr));
}

export function getBriefingSummary(briefing: HouseholdBriefing, hidden: boolean) {
  if (!hidden) return briefing.summary;
  if (briefing.status === "STABLE") return "El hogar viene estable este mes.";
  if (briefing.status === "LOW_ACTIVITY") return "Todavía no hay suficientes movimientos compartidos.";
  if (briefing.status === "HIGH_SPEND") return "El gasto compartido viene más alto que lo habitual.";
  if (!briefing.settlement) return "Hay un saldo pendiente por equilibrar.";
  return `${briefing.settlement.fromName} tiene un saldo pendiente con ${briefing.settlement.toName}.`;
}

export function getBriefingBadgeClass(status: HouseholdBriefingStatus) {
  if (status === "STABLE") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (status === "NEEDS_BALANCE") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  if (status === "HIGH_SPEND") return "border-sky-300/20 bg-sky-300/10 text-sky-100";
  return "border-white/10 bg-white/[0.06] text-zinc-200";
}

export function getBriefingPanelClass(status: HouseholdBriefingStatus | undefined) {
  if (status === "STABLE") return "border-emerald-300/15 bg-emerald-300/10";
  if (status === "NEEDS_BALANCE") return "border-amber-300/15 bg-amber-300/10";
  if (status === "HIGH_SPEND") return "border-sky-300/15 bg-sky-300/10";
  return "border-white/10 bg-white/[0.04]";
}

export function getRecurringPanelClass(rp: RecurringPaymentsSummary) {
  if (rp.overdueCount > 0) return "border-amber-300/20 bg-amber-300/10";
  if (rp.paidCount === rp.totalCount) return "border-emerald-300/20 bg-emerald-300/10";
  return "border-white/10 bg-white/[0.04]";
}

export function getPaymentRowClass(status: "PENDING" | "PAID" | "OVERDUE") {
  if (status === "PAID") return "border-emerald-300/15 bg-emerald-300/[0.06] opacity-70";
  if (status === "OVERDUE") return "border-amber-300/20 bg-amber-300/[0.07]";
  return "border-white/10 bg-white/[0.04]";
}

export function getPaymentIconClass(status: "PENDING" | "PAID" | "OVERDUE") {
  if (status === "PAID") return "bg-emerald-300/15 text-emerald-300";
  if (status === "OVERDUE") return "bg-amber-300/15 text-amber-300";
  return "bg-white/[0.07] text-zinc-500";
}
