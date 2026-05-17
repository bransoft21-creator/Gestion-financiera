/**
 * Monthly signal engine — deterministic, no AI.
 *
 * FRAMING CONTRACT:
 * Monthly signals describe the RHYTHM and OUTCOME of a closed month — not
 * structural verdicts on the user's financial health. Rent, card payments, and
 * scheduled obligations are expected events, never treated as negative signals.
 * "warning" severity is reserved for genuinely anomalous patterns (e.g., real
 * available went negative despite income). Severity "neutral" covers everything
 * worth noting without judgment.
 */

export type MonthlySignalSeverity = "positive" | "neutral" | "warning";

export interface MonthlySignal {
  id: string;
  label: string;
  severity: MonthlySignalSeverity;
}

export interface MonthlySnapshotMetrics {
  income: number;
  expenses: number;
  available: number;
  reserved: number;
  obligations: number;
}

function pct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function generateMonthlySignals(
  current: MonthlySnapshotMetrics,
  previous: MonthlySnapshotMetrics | null,
): MonthlySignal[] {
  if (current.income === 0 && current.expenses === 0) return [];

  const signals: MonthlySignal[] = [];

  // ── Expense trend vs previous month ─────────────────────────────────────────
  if (previous && previous.expenses > 0) {
    const expPct = pct(current.expenses, previous.expenses);
    if (expPct !== null) {
      if (expPct < -10) {
        signals.push({
          id: "EXPENSES_DOWN",
          label: `Los gastos bajaron un ${Math.abs(Math.round(expPct))}% respecto al mes anterior`,
          severity: "positive",
        });
      } else if (expPct > 20) {
        signals.push({
          id: "EXPENSES_UP",
          label: "El mes tuvo más movimiento de gasto que el anterior",
          severity: "neutral",
        });
      } else if (Math.abs(expPct) <= 8) {
        signals.push({
          id: "STABLE_MONTH",
          label: "El ritmo de gasto se mantuvo similar al mes anterior",
          severity: "positive",
        });
      }
    }
  }

  // ── Available real (margen de cierre) ────────────────────────────────────────
  if (current.income > 0) {
    const availRate = current.available / current.income;

    if (current.available < 0) {
      signals.push({
        id: "NEGATIVE_AVAILABLE",
        label: "El mes cerró con disponible real negativo",
        severity: "warning",
      });
    } else if (availRate > 0.18) {
      signals.push({
        id: "GOOD_AVAILABLE",
        label: "El mes cerró con un margen sólido de disponible real",
        severity: "positive",
      });
    } else if (availRate < 0.05 && current.available >= 0) {
      signals.push({
        id: "TIGHT_MARGIN",
        label: "El disponible real estuvo muy ajustado al cierre",
        severity: "neutral",
      });
    }
  }

  // ── Margin improvement vs previous ──────────────────────────────────────────
  if (previous !== null && previous.available >= 0 && current.available > previous.available) {
    signals.push({
      id: "MARGIN_BETTER",
      label: "Cerraste con más disponible real que el mes anterior",
      severity: "positive",
    });
  }

  // ── Obligations pressure ─────────────────────────────────────────────────────
  if (current.income > 0 && current.obligations > 0) {
    const oblRate = current.obligations / current.income;
    if (oblRate > 0.40) {
      signals.push({
        id: "OBLIGATIONS_HIGH",
        label: `Las obligaciones representaron el ${Math.round(oblRate * 100)}% de los ingresos del mes`,
        severity: "neutral",
      });
    }
  }

  // Deduplicate: avoid redundant positive signals if MARGIN_BETTER and GOOD_AVAILABLE both fire
  const ids = signals.map((s) => s.id);
  const filtered = signals.filter((s) => {
    if (s.id === "GOOD_AVAILABLE" && ids.includes("MARGIN_BETTER")) return false;
    return true;
  });

  // Return max 3, warnings and neutrals first so they're not buried
  const warnings = filtered.filter((s) => s.severity === "warning");
  const neutrals = filtered.filter((s) => s.severity === "neutral");
  const positives = filtered.filter((s) => s.severity === "positive");

  return [...warnings, ...neutrals, ...positives].slice(0, 3);
}
