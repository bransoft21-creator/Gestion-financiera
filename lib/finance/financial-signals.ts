/**
 * Layer 2 — Heuristic signal engine (no AI).
 * Deterministic rules that detect behavioral patterns and anomalies.
 * All thresholds are intentionally readable — adjust without touching AI.
 *
 * FRAMING CONTRACT:
 * Weekly signals represent RHYTHM, ACTIVITY and MOVEMENT — not structural
 * financial health. Rent, card payments, and services are scheduled events,
 * not daily-repeatable expenses. Severity "warning" is reserved for genuine
 * anomalies (e.g., a category absorbing >28% of all weekly spend), never
 * for high-flow weeks caused by normal monthly obligations.
 * Structural health (savings rate, net worth, debt) lives in the monthly
 * dashboard — not here.
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
  // Threshold raised (25→40%) to avoid flagging normal month-start spikes as notable.
  // Severity downgraded: expense movement is ACTIVITY context, not health judgment.
  if (comparison.available && comparison.expensesPct !== null) {
    if (comparison.expensesPct < -10) {
      signals.push({
        id: "EXPENSES_DOWN",
        label: `El flujo de gasto bajó un ${Math.abs(Math.round(comparison.expensesPct))}% respecto a la semana anterior`,
        severity: "positive",
      });
    } else if (comparison.expensesPct > 40) {
      signals.push({
        id: "EXPENSES_UP",
        label: "El flujo de gasto estuvo más activo esta semana",
        severity: "neutral",
      });
    } else if (Math.abs(comparison.expensesPct) <= 8) {
      signals.push({
        id: "STABLE_WEEK",
        label: "El ritmo de gasto se mantuvo parejo respecto a la semana anterior",
        severity: "positive",
      });
    }
  }

  // ── Weekend concentration ─────────────────────────────────────────────────
  // Neutral: weekend spending is a pattern observation, not a health warning.
  if (metrics.weekendPct > 45 && metrics.transactionCount > 3) {
    signals.push({
      id: "WEEKEND_SPIKE",
      label: `El fin de semana concentró el ${Math.round(metrics.weekendPct)}% del flujo semanal`,
      severity: "neutral",
    });
  }

  // ── Delivery / food category ─────────────────────────────────────────────────
  const deliveryCat = metrics.categoryBreakdown.find((c) => matchesCat(c.name, DELIVERY_FRAGMENTS));
  if (deliveryCat && deliveryCat.pct > 28) {
    signals.push({
      id: "DELIVERY_HIGH",
      label: `${deliveryCat.name} representó el ${Math.round(deliveryCat.pct)}% de los gastos esta semana`,
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
      label: `Transporte tuvo más movimiento que la semana anterior`,
      severity: "neutral",
    });
  }

  // ── Weekly flow balance ──────────────────────────────────────────────────────
  // NOTE: This is FLOW context, not structural savings health.
  // "savingsRate" here means balance/income for the week — a week with
  // rent or card payments will show low savingsRate even with a healthy month.
  // GOOD_SAVINGS → "flujo liviano", severity positive (no change)
  // LOW_SAVINGS  → "flujo intenso", severity NEUTRAL (was warning — rent ≠ bad habit)
  if (metrics.totalIncome > 0) {
    if (metrics.savingsRate >= 25) {
      signals.push({
        id: "GOOD_SAVINGS",
        label: "La semana cerró con un balance positivo de flujo",
        severity: "positive",
      });
    } else if (metrics.savingsRate < 5) {
      signals.push({
        id: "LOW_SAVINGS",
        label: "La semana tuvo un flujo de gasto elevado",
        severity: "neutral",
      });
    }
  }

  // ── Category dominance ───────────────────────────────────────────────────────
  if (metrics.topCategory && metrics.topCategory.pct > 55 && metrics.transactionCount > 4) {
    signals.push({
      id: "CATEGORY_DOMINANT",
      label: `${metrics.topCategory.name} concentró más de la mitad del gasto semanal`,
      severity: "neutral",
    });
  }

  // ── Credit card heavy use ────────────────────────────────────────────────────
  if (metrics.creditPct > 75 && metrics.totalExpenses > 0) {
    signals.push({
      id: "CREDIT_HEAVY",
      label: `El ${Math.round(metrics.creditPct)}% del gasto semanal fue con tarjeta de crédito`,
      severity: "neutral",
    });
  }

  // ── Low activity ─────────────────────────────────────────────────────────────
  if (metrics.transactionCount === 0) {
    signals.push({ id: "NO_DATA", label: "No hay transacciones registradas esta semana", severity: "neutral" });
  } else if (metrics.transactionCount < 3) {
    signals.push({ id: "LOW_ACTIVITY", label: "Pocos movimientos registrados esta semana", severity: "neutral" });
  }

  // Return max 4 signals — warnings first so they reach the AI prompt with priority
  const warnings = signals.filter((s) => s.severity === "warning");
  const neutrals = signals.filter((s) => s.severity === "neutral");
  const positives = signals.filter((s) => s.severity === "positive");

  return [...warnings, ...neutrals, ...positives].slice(0, 4);
}
