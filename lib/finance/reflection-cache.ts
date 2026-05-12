/**
 * Cache + hash utilities for weekly reflections.
 * Hash is built from rounded/bucketed values to absorb minor float differences
 * without triggering unnecessary AI regenerations.
 */

import { createHash } from "node:crypto";
import type { WeeklyMetrics } from "./financial-analytics";
import type { Signal } from "./financial-signals";

/** Short SHA-256 fingerprint for a given metrics + signals snapshot */
export function buildWeeklyInputHash(metrics: WeeklyMetrics, signals: Signal[]): string {
  const fingerprint = {
    // Round to nearest 50 to tolerate tiny float changes in amounts
    exp: Math.round(metrics.totalExpenses / 50) * 50,
    inc: Math.round(metrics.totalIncome / 50) * 50,
    top: metrics.topCategory?.name ?? null,
    wkndBucket: Math.round(metrics.weekendPct / 5) * 5, // 5% buckets
    sigs: signals.map((s) => s.id).sort().join(","),
    cnt: metrics.transactionCount,
  };
  return createHash("sha256")
    .update(JSON.stringify(fingerprint))
    .digest("hex")
    .slice(0, 16);
}

/** Human-readable Argentine week label: "5 al 11 de mayo" */
export function buildWeekLabel(start: Date, end: Date): string {
  const MONTHS = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre",
  ];
  const startDay = start.getDate();
  const endDay = end.getDate();
  const month = MONTHS[end.getMonth()];

  if (start.getMonth() === end.getMonth()) {
    return `${startDay} al ${endDay} de ${month}`;
  }
  // Week spans two months
  return `${startDay} de ${MONTHS[start.getMonth()]} al ${endDay} de ${month}`;
}
