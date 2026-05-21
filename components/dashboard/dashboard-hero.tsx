"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { useCountUp } from "@/hooks/use-count-up";
import { useFxRate } from "@/hooks/use-fx-rate";
import { fxEstimate } from "@/lib/fx";
import { PremiumCard } from "@/components/ui-v2/premium-card";
import {
  formatMoney,
  MONTH_NAMES,
  getHeroHeadline,
  getHeroPrimarySignal,
} from "@/app/(private)/dashboard/utils";
import type { DashboardSummary } from "@/app/(private)/dashboard/types";

export function DashboardHero({
  metrics,
  year,
  month,
  usdBalance,
  onPrevMonth,
  onNextMonth,
  isCurrentMonth,
}: {
  metrics: DashboardSummary["metrics"];
  year: number;
  month: number;
  usdBalance?: { amount: number; accountCount: number };
  onPrevMonth: () => void;
  onNextMonth: () => void;
  isCurrentMonth: boolean;
}) {
  const currency = metrics.currency;
  const animated = useCountUp(metrics.realAvailable);
  const isPositive = metrics.realAvailable >= 0;
  const { rate: fxRate, loaded: fxLoaded } = useFxRate();

  const hasData = metrics.income > 0 || metrics.expenses > 0;
  const headline = getHeroHeadline(metrics);
  const primarySignal = hasData ? getHeroPrimarySignal(metrics) : null;

  function scrollToLectura() {
    document
      .querySelector('[data-tutorial="financial-copilot"]')
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <PremiumCard data-tutorial="dashboard-hero" variant="raised" className="relative mb-4 overflow-hidden p-4 sm:p-5">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(45,212,191,.18)_0%,transparent_68%)]" />
      <div className="pointer-events-none absolute bottom-[-8rem] left-[-6rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,.12)_0%,transparent_68%)]" />

      <div className="relative">
        {/* Month navigation — compact utility row */}
        <div className="mb-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrevMonth}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span className="text-[11px] font-medium text-muted-foreground">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            type="button"
            onClick={onNextMonth}
            disabled={isCurrentMonth}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/50 hover:text-foreground disabled:opacity-30"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {metrics.currencyScope.mixedCurrencies && (
            <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Vista {currency}
            </span>
          )}
        </div>

        {/* Headline — protagonist */}
        <h2 className="text-balance text-xl font-semibold leading-tight text-foreground sm:text-2xl">
          {headline}
        </h2>

        {/* Available — the number that matters */}
        <p
          className={cn(
            "mt-3 text-[40px] font-semibold leading-none tracking-tight tabular-nums sm:text-[44px]",
            isPositive ? "text-emerald-400" : "text-rose-400",
          )}
        >
          <SensitiveAmount value={formatMoney(animated, currency)} />
        </p>

        {/* Spending bar — inline, no separator block */}
        {metrics.income > 0 && (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
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
            <span
              className={cn(
                "shrink-0 text-[11px] tabular-nums",
                metrics.spendingRate >= 100
                  ? "font-semibold text-rose-400"
                  : metrics.spendingRate >= 80
                    ? "font-semibold text-amber-400"
                    : "text-muted-foreground",
              )}
            >
              {metrics.spendingRate}%
            </span>
          </div>
        )}

        {/* Formula — single text line with links */}
        {hasData && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            <Link href="/transactions?type=INCOME" className="transition hover:text-foreground">
              Ing <SensitiveAmount value={formatMoney(metrics.income, currency)} />
            </Link>
            {" · "}
            <Link href="/transactions?type=EXPENSE" className="transition hover:text-foreground">
              Gas <SensitiveAmount value={formatMoney(metrics.expenses, currency)} />
            </Link>
            {" · "}
            <Link href="/budgets" className="transition hover:text-foreground">
              Res <SensitiveAmount value={formatMoney(metrics.remainingReservedBudget, currency)} />
            </Link>
            {" · "}
            <Link href="/recurring" className="transition hover:text-foreground">
              Obl <SensitiveAmount value={formatMoney(metrics.upcomingObligations, currency)} />
            </Link>
          </p>
        )}

        {/* USD inline */}
        {usdBalance && usdBalance.accountCount > 0 && (
          <p className="mt-1 text-[11px] text-sky-400">
            + <SensitiveAmount value={formatMoney(usdBalance.amount, "USD")} /> en USD
            {fxLoaded && (
              <span className="text-muted-foreground/70">
                {" · ≈ "}
                <SensitiveAmount value={formatMoney(fxEstimate(usdBalance.amount, "USD", "ARS", fxRate) ?? 0)} />
              </span>
            )}
          </p>
        )}

        {/* Mixed currency note */}
        {metrics.currencyScope.mixedCurrencies && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Hay movimientos en {metrics.currencyScope.ignoredCurrencies.join(", ")}. No se mezclan.
          </p>
        )}

        {/* Single signal — the only accent */}
        {primarySignal && (
          <div className="mt-3 flex items-start gap-2">
            <span
              className={cn(
                "mt-1 h-2 w-2 shrink-0 rounded-full",
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

        {/* Bottom row: secondary data + CTA */}
        {hasData && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              Ahorro{" "}
              <span
                className={
                  metrics.savingsRate >= 0
                    ? "font-medium text-emerald-400"
                    : "font-medium text-rose-400"
                }
              >
                {metrics.savingsRate}%
              </span>
              {" · Cierre "}
              <SensitiveAmount value={formatMoney(metrics.projection.projectedRealAvailable, currency)} />
            </p>
            <button
              type="button"
              onClick={scrollToLectura}
              className="shrink-0 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
            >
              Revisar detalle →
            </button>
          </div>
        )}
      </div>
    </PremiumCard>
  );
}
