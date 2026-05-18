"use client";

import { TrendingUp } from "lucide-react";
import {
  PremiumCard,
  PremiumCardContent,
  PremiumCardDescription,
  PremiumCardHeader,
  PremiumCardTitle,
} from "@/components/ui-v2/premium-card";
import { SensitiveAmount, SensitiveText } from "@/components/app/sensitive-amount";
import { formatMoney, buildNarrative } from "@/app/(private)/dashboard/utils";
import type { DashboardSummary } from "@/app/(private)/dashboard/types";

function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  const label = confidence === "high" ? "Alta" : confidence === "medium" ? "Media" : "Baja";
  const cls =
    confidence === "high"
      ? "border-teal-300/20 bg-teal-300/10 text-teal-400"
      : confidence === "medium"
        ? "border-amber-300/20 bg-amber-300/10 text-amber-400"
        : "border-border bg-muted/30 text-muted-foreground";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      Confianza: {label}
    </span>
  );
}

function getSubtitle(projection: DashboardSummary["metrics"]["projection"]): string {
  if (projection.hasEarlyLargeFixed) {
    return "Pagos grandes del inicio no se proyectan como gasto diario.";
  }
  if (projection.confidence === "low") {
    return "Pocos datos aún — la estimación mejora con más días.";
  }
  if (projection.confidence === "medium") {
    return "Estimación en progreso. Clasificar gastos mejora la precisión.";
  }
  return "Proyección ajustada por tipo de gasto.";
}

export function MonthProjection({ metrics }: { metrics: DashboardSummary["metrics"] }) {
  const { projection } = metrics;
  if (!projection.isCurrentMonth || metrics.income === 0) return null;

  const narrative = buildNarrative(metrics);
  const subtitle = getSubtitle(projection);

  return (
    <PremiumCard>
      <PremiumCardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-teal-300/12 text-primary">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <PremiumCardTitle className="text-sm">Cierre estimado</PremiumCardTitle>
            <PremiumCardDescription>{subtitle}</PremiumCardDescription>
          </div>
        </div>
      </PremiumCardHeader>
      <PremiumCardContent className="space-y-4">
        {narrative && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            <SensitiveText text={narrative} />
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-muted/25 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Gasto proyectado
            </p>
            <p
              className={`mt-1 text-sm font-bold tabular-nums ${
                projection.projectedExpenses > metrics.income ? "text-rose-400" : "text-foreground"
              }`}
            >
              <SensitiveAmount value={formatMoney(projection.projectedExpenses, metrics.currency)} />
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/25 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Saldo estimado
            </p>
            <p
              className={`mt-1 text-sm font-bold tabular-nums ${
                projection.projectedBalance >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              <SensitiveAmount value={formatMoney(projection.projectedBalance, metrics.currency)} />
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            Quedan{" "}
            <span className="font-semibold text-foreground">{projection.daysRemaining}</span>{" "}
            día{projection.daysRemaining !== 1 ? "s" : ""} del mes
            {projection.confidenceNote ? (
              <span> · {projection.confidenceNote}</span>
            ) : null}
          </p>
          {projection.isCurrentMonth && (
            <ConfidenceBadge confidence={projection.confidence} />
          )}
        </div>
      </PremiumCardContent>
    </PremiumCard>
  );
}
