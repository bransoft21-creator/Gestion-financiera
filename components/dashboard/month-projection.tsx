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

export function MonthProjection({ metrics }: { metrics: DashboardSummary["metrics"] }) {
  const { projection } = metrics;
  if (!projection.isCurrentMonth || metrics.income === 0) return null;

  const dailyRate = projection.dayOfMonth > 0
    ? Math.round(metrics.expenses / projection.dayOfMonth)
    : 0;
  const narrative = buildNarrative(metrics);

  return (
    <PremiumCard>
      <PremiumCardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-teal-300/12 text-teal-100">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <PremiumCardTitle className="text-sm">Tendencia del mes</PremiumCardTitle>
            <PremiumCardDescription>A este ritmo, así cierra tu mes.</PremiumCardDescription>
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
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Gasto al cierre
            </p>
            <p
              className={`mt-1 text-sm font-bold tabular-nums ${
                projection.projectedExpenses > metrics.income ? "text-rose-400" : "text-foreground"
              }`}
            >
              <SensitiveAmount value={formatMoney(projection.projectedExpenses)} />
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Saldo proyectado
            </p>
            <p
              className={`mt-1 text-sm font-bold tabular-nums ${
                projection.projectedBalance >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              <SensitiveAmount value={formatMoney(projection.projectedBalance)} />
            </p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Quedan{" "}
          <span className="font-semibold text-foreground">{projection.daysRemaining}</span>{" "}
          día{projection.daysRemaining !== 1 ? "s" : ""} del mes · Ritmo actual:{" "}
          <span className="font-semibold text-foreground">
            <SensitiveAmount value={formatMoney(dailyRate)} />
          </span>/día
        </p>
      </PremiumCardContent>
    </PremiumCard>
  );
}
