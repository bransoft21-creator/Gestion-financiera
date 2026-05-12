/**
 * Layer 2 — Heuristic signal engine (no AI).
 * Deterministic rules that detect behavioral patterns and anomalies.
 * All thresholds are intentionally readable — adjust without touching AI.
 */

import type { WeeklyMetrics, WeeklyComparison } from "./financial-analytics";

export type SignalSeverity = "positive" | "neutral" | "warning";

export interface Signal {
  id: string;
  label: string;   // Human-readable — used verbatim in AI prompt
  severity: SignalSeverity;
}

// Category name substrings (lowercase) mapped to delivery/food
const DELIVERY_FRAGMENTS = ["delivery", "rappi", "pedidos", "uber eat", "restaurante", "comida", "almuerzo", "cena"];
// Category name substrings mapped to transport
const TRANSPORT_FRAGMENTS = ["transporte", "combustible", "estacionamiento", "cuota auto", "nafta", "taxi", "cabify", "uber"];

function matchesCat(name: string, fragments: string[]): boolean {
  const lower = name.toLowerCase();
  return fragments.some((f) => lower.includes(f));
}

export function generateWeeklySignals(
  metrics: WeeklyMetrics,
  comparison: WeeklyComparison,
): Signal[] {
  if (!metrics.hasData) return [];

  const signals: Signal[] = [];

  // ── Expenses trend ──────────────────────────────────────────────────────────
  if (comparison.available && comparison.expensesPct !== null) {
    if (comparison.expensesPct < -10) {
      signals.push({
        id: "EXPENSES_DOWN",
        label: `Tus gastos bajaron un ${Math.abs(Math.round(comparison.expensesPct))}% respecto a la semana anterior`,
        severity: "positive",
      });
    } else if (comparison.expensesPct > 25) {
      signals.push({
        id: "EXPENSES_UP",
        label: `Tus gastos subieron un ${Math.round(comparison.expensesPct)}% respecto a la semana anterior`,
        severity: "warning",
      });
    } else if (Math.abs(comparison.expensesPct) <= 8) {
      signals.push({
        id: "STABLE_WEEK",
        label: "Tu gasto semanal se mantuvo estable respecto a la semana anterior",
        severity: "positive",
      });
    }
  }

  // ── Weekend spike ────────────────────────────────────────────────────────────
  if (metrics.weekendPct > 45 && metrics.transactionCount > 3) {
    signals.push({
      id: "WEEKEND_SPIKE",
      label: `El ${Math.round(metrics.weekendPct)}% de tus gastos fue en el fin de semana`,
      severity: "warning",
    });
  }

  // ── Delivery / food category ─────────────────────────────────────────────────
  const deliveryCat = metrics.categoryBreakdown.find((c) => matchesCat(c.name, DELIVERY_FRAGMENTS));
  if (deliveryCat && deliveryCat.pct > 28) {
    signals.push({
      id: "DELIVERY_HIGH",
      label: `${deliveryCat.name} representó el ${Math.round(deliveryCat.pct)}% de tus gastos`,
      severity: "warning",
    });
  }

  // ── Transport growth ─────────────────────────────────────────────────────────
  const transportCat = metrics.categoryBreakdown.find((c) => matchesCat(c.name, TRANSPORT_FRAGMENTS));
  if (
    transportCat &&
    comparison.available &&
    comparison.topCategoryChange?.name &&
    matchesCat(comparison.topCategoryChange.name, TRANSPORT_FRAGMENTS) &&
    (comparison.topCategoryChange.pct ?? 0) > 20
  ) {
    signals.push({
      id: "TRANSPORT_GROWTH",
      label: `Tus gastos en ${transportCat.name} crecieron esta semana`,
      severity: "neutral",
    });
  }

  // ── Savings rate ─────────────────────────────────────────────────────────────
  if (metrics.totalIncome > 0) {
    if (metrics.savingsRate >= 25) {
      signals.push({
        id: "GOOD_SAVINGS",
        label: `Mantuviste una tasa de ahorro del ${Math.round(metrics.savingsRate)}%`,
        severity: "positive",
      });
    } else if (metrics.savingsRate < 5) {
      signals.push({
        id: "LOW_SAVINGS",
        label: "Tu tasa de ahorro esta semana fue muy baja",
        severity: "warning",
      });
    }
  }

  // ── Category dominance ───────────────────────────────────────────────────────
  if (metrics.topCategory && metrics.topCategory.pct > 55 && metrics.transactionCount > 4) {
    signals.push({
      id: "CATEGORY_DOMINANT",
      label: `${metrics.topCategory.name} concentró más del 55% de tus gastos`,
      severity: "neutral",
    });
  }

  // ── Credit card heavy use ────────────────────────────────────────────────────
  if (metrics.creditPct > 75 && metrics.totalExpenses > 0) {
    signals.push({
      id: "CREDIT_HEAVY",
      label: `El ${Math.round(metrics.creditPct)}% de tus gastos fue con tarjeta de crédito`,
      severity: "neutral",
    });
  }

  // ── Low activity ─────────────────────────────────────────────────────────────
  if (metrics.transactionCount === 0) {
    signals.push({ id: "NO_DATA", label: "No hay transacciones registradas esta semana", severity: "neutral" });
  } else if (metrics.transactionCount < 3) {
    signals.push({ id: "LOW_ACTIVITY", label: "Pocos movimientos registrados esta semana", severity: "neutral" });
  }

  // Return max 4 signals — sorted so positives come last (AI gets the negatives first)
  const warnings = signals.filter((s) => s.severity === "warning");
  const neutrals = signals.filter((s) => s.severity === "neutral");
  const positives = signals.filter((s) => s.severity === "positive");

  return [...warnings, ...neutrals, ...positives].slice(0, 4);
}
