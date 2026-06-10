"use client";

"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { useCountUp } from "@/hooks/use-count-up";
import { useFxRate } from "@/hooks/use-fx-rate";
import { fxEstimate } from "@/lib/fx";
import { PremiumCard } from "@/components/ui-v2/premium-card";
import {
  formatMoney,
  MONTH_NAMES,
  buildHealthSignals,
  getHeroHeadline,
  getHeroPrimarySignal,
} from "@/app/(private)/dashboard/utils";
import type { DashboardSummary } from "@/app/(private)/dashboard/types";
import type { PeriodStatus } from "@/lib/period-status";

function FormulaPill({
  label,
  value,
  color,
  href,
  currency,
}: {
  label: string;
  value: number;
  color: string;
  href: string;
  currency: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 transition hover:bg-muted/70"
      aria-label={label}
    >
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span
        className="max-w-[8rem] truncate text-[13px] font-semibold tabular-nums"
        style={{ color }}
      >
        <SensitiveAmount value={formatMoney(value, currency)} />
      </span>
    </Link>
  );
}

export function DashboardHero({
  metrics,
  year,
  month,
  usdBalance,
  onPrevMonth,
  onNextMonth,
  isCurrentMonth,
  periodStatus,
}: {
  metrics: DashboardSummary["metrics"];
  year: number;
  month: number;
  usdBalance?: { amount: number; accountCount: number };
  onPrevMonth: () => void;
  onNextMonth: () => void;
  isCurrentMonth: boolean;
  periodStatus?: PeriodStatus;
}) {
  const currency = metrics.currency;
  const animated = useCountUp(metrics.realAvailable);
  const isPositive = metrics.realAvailable >= 0;
  const { rate: fxRate, loaded: fxLoaded } = useFxRate();

  const hasData = metrics.income > 0 || metrics.expenses > 0;
  const headline = getHeroHeadline(metrics, isCurrentMonth);
  const primarySignal = hasData ? getHeroPrimarySignal(metrics, isCurrentMonth) : null;
  const healthSignals = hasData ? buildHealthSignals(metrics, isCurrentMonth).slice(0, 1) : [];
  const incomeLabel = periodStatus === "CLOSED" ? "Total cobrado" : "Ingresos";
  const expensesLabel = periodStatus === "CLOSED" ? "Total gastado" : "Gastos";
  const obligationsLabel = periodStatus === "CLOSED" ? "Compromisos pagados" : "Compromisos";

  return (
    <PremiumCard data-tutorial="dashboard-hero" variant="raised" className="mb-5 overflow-hidden p-5 sm:mb-7 sm:p-6">
      <div className="min-w-0">
          {/* Month navigation */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={onPrevMonth}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="px-2 text-[13px] font-semibold text-foreground">
                  {MONTH_NAMES[month - 1]} {year}
                </span>
                <button
                  type="button"
                  onClick={onNextMonth}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {periodStatus && periodStatus !== "OPEN" && (
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                    periodStatus === "CLOSED"
                      ? "border-border bg-muted/40 text-muted-foreground"
                      : "border-sky-300/20 bg-sky-300/[0.08] text-sky-400",
                  )}
                >
                  {periodStatus === "CLOSED" ? "cerrado" : "próximo"}
                </span>
              )}
              {metrics.currencyScope.mixedCurrencies && (
                <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  Vista {currency}
                </span>
              )}
            </div>
            {periodStatus !== "CLOSED" && (
              <Link
                href="/transactions?new=1"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.08] px-4 text-[13px] font-semibold text-primary backdrop-blur-sm transition-all duration-200 hover:border-primary/40 hover:bg-primary/[0.14] hover:shadow-[0_0_14px_var(--glow-primary)] active:scale-95"
                aria-label="Nueva transacción"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Nueva transacción</span>
                <span className="sm:hidden">Nueva</span>
              </Link>
            )}
          </div>

          <h2 className={cn(
            "text-balance text-2xl leading-tight sm:text-3xl",
            periodStatus === "CLOSED"
              ? "font-medium text-foreground/70"
              : "font-semibold text-foreground",
          )}>
            {headline}
          </h2>

          <p
            className={cn(
              "mt-5 text-[52px] font-medium leading-none tracking-tight tabular-nums sm:text-[62px]",
              periodStatus === "CLOSED"
                ? isPositive ? "text-emerald-400/70" : "text-rose-400/70"
                : isPositive ? "text-emerald-400" : "text-rose-400",
            )}
          >
            <SensitiveAmount value={formatMoney(animated, currency)} />
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <FormulaPill label={incomeLabel} value={metrics.income} color="#34d399" href="/transactions?type=INCOME" currency={currency} />
            <span aria-hidden="true" className="font-medium text-muted-foreground/60">−</span>
            <FormulaPill label={expensesLabel} value={metrics.expenses} color="#f87171" href="/transactions?type=EXPENSE" currency={currency} />
            <span aria-hidden="true" className="font-medium text-muted-foreground/60">−</span>
            <FormulaPill label="Reservado" value={metrics.remainingReservedBudget} color="#fbbf24" href="/budgets" currency={currency} />
            <span aria-hidden="true" className="font-medium text-muted-foreground/60">−</span>
            <FormulaPill label={obligationsLabel} value={metrics.upcomingObligations - metrics.requiredGoalContributions} color="#60a5fa" href="/commitments" currency={currency} />
            {metrics.requiredGoalContributions > 0 && (
              <>
                <span aria-hidden="true" className="font-medium text-muted-foreground/60">−</span>
                <FormulaPill label="Metas" value={metrics.requiredGoalContributions} color="#a78bfa" href="/goals" currency={currency} />
              </>
            )}
          </div>

          {metrics.currencyScope.mixedCurrencies && (
            <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
              Hay movimientos en {metrics.currencyScope.ignoredCurrencies.join(", ")}. No se mezclan con esta vista.
            </p>
          )}

          {metrics.income > 0 && (
            <div className="mt-4 max-w-2xl border-t border-border pt-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground/60">Ingreso consumido</span>
                <span
                  className={
                    metrics.spendingRate >= 100
                      ? "font-semibold text-rose-400"
                      : metrics.spendingRate >= 80
                        ? "font-semibold text-amber-400"
                        : "text-muted-foreground"
                  }
                >
                  {metrics.spendingRate}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    metrics.spendingRate >= 100
                      ? "bg-rose-500"
                      : metrics.spendingRate >= 80
                        ? "bg-amber-500"
                        : "bg-emerald-500",
                  )}
                  style={{ width: `${Math.min(metrics.spendingRate, 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {/* Savings rate badge — always visible */}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
                metrics.savingsRate >= 0
                  ? "border-sky-500/12 bg-sky-500/[0.06] text-sky-500"
                  : "border-rose-500/12 bg-rose-500/[0.07] text-rose-400",
              )}
            >
              <span className={cn("h-1 w-1 shrink-0 rounded-full", metrics.savingsRate >= 0 ? "bg-sky-500" : "bg-rose-400")} />
              Ahorro {metrics.savingsRate}%
            </span>
            {/* Top health signal — takes priority over USD badge */}
            {healthSignals.length > 0
              ? healthSignals.map((signal) => (
                  <span
                    key={signal.label}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
                      signal.tone === "positive"
                        ? "border-emerald-500/12 bg-emerald-500/[0.07] text-emerald-500"
                        : "border-amber-500/12 bg-amber-500/[0.07] text-amber-500",
                    )}
                  >
                    <span className={cn("h-1 w-1 shrink-0 rounded-full", signal.tone === "positive" ? "bg-emerald-500" : "bg-amber-500")} />
                    {signal.label}
                  </span>
                ))
              : usdBalance && usdBalance.accountCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/20 bg-sky-300/[0.06] px-2.5 py-0.5 text-[10px] font-medium text-sky-400">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-sky-400" />
                    <SensitiveAmount value={formatMoney(usdBalance.amount, "USD")} />
                    {fxLoaded ? <> · ≈ <SensitiveAmount value={formatMoney(fxEstimate(usdBalance.amount, "USD", "ARS", fxRate) ?? 0)} /></> : null}
                  </span>
                )}
          </div>

          {primarySignal && (
            <div className="mt-3 flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  primarySignal.tone === "positive"
                    ? "bg-emerald-400"
                    : primarySignal.tone === "warning"
                      ? "bg-amber-400"
                      : "bg-rose-400",
                )}
              />
              <p
                className={cn(
                  "text-sm leading-snug",
                  primarySignal.tone === "positive"
                    ? "text-emerald-400/80"
                    : primarySignal.tone === "warning"
                      ? "text-amber-500"
                      : "text-rose-400",
                )}
              >
                {primarySignal.text}
              </p>
            </div>
          )}

      </div>
    </PremiumCard>
  );
}
