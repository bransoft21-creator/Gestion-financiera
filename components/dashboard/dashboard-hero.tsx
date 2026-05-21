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
  buildHealthSignals,
  getHeroHeadline,
  getHeroPrimarySignal,
} from "@/app/(private)/dashboard/utils";
import type { DashboardSummary } from "@/app/(private)/dashboard/types";

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
      className="flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 transition hover:bg-muted/70"
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
  const healthSignals = hasData ? buildHealthSignals(metrics).slice(0, 2) : [];

  function scrollToLectura() {
    document
      .querySelector('[data-tutorial="financial-copilot"]')
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <PremiumCard data-tutorial="dashboard-hero" variant="raised" className="relative mb-5 overflow-hidden p-5 sm:mb-7 sm:p-6">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(45,212,191,.18)_0%,transparent_68%)]" />
      <div className="pointer-events-none absolute bottom-[-8rem] left-[-6rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,.12)_0%,transparent_68%)]" />

      <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0">
          {/* Month navigation */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
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
                disabled={isCurrentMonth}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/60 hover:text-foreground disabled:opacity-30"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {metrics.currencyScope.mixedCurrencies && (
              <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                Vista {currency}
              </span>
            )}
          </div>

          <h2 className="text-balance text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            {headline}
          </h2>

          <p
            className={cn(
              "mt-5 text-[38px] font-semibold leading-none tracking-tight tabular-nums sm:text-[44px]",
              isPositive ? "text-emerald-400" : "text-rose-400",
            )}
          >
            <SensitiveAmount value={formatMoney(animated, currency)} />
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <FormulaPill label="Ingresos" value={metrics.income} color="#34d399" href="/transactions?type=INCOME" currency={currency} />
            <span aria-hidden="true">−</span>
            <FormulaPill label="Gastos" value={metrics.expenses} color="#f87171" href="/transactions?type=EXPENSE" currency={currency} />
            <span aria-hidden="true">−</span>
            <FormulaPill label="Reservado" value={metrics.remainingReservedBudget} color="#fbbf24" href="/budgets" currency={currency} />
            <span aria-hidden="true">−</span>
            <FormulaPill label="Obligaciones" value={metrics.upcomingObligations} color="#60a5fa" href="/recurring" currency={currency} />
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

          {healthSignals.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {healthSignals.map((signal) => (
                <span
                  key={signal.label}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
                    signal.tone === "positive"
                      ? "border-emerald-500/12 bg-emerald-500/[0.07] text-emerald-500"
                      : "border-amber-500/12 bg-amber-500/[0.07] text-amber-500",
                  )}
                >
                  <span
                    className={cn(
                      "h-1 w-1 shrink-0 rounded-full",
                      signal.tone === "positive" ? "bg-emerald-500" : "bg-amber-500",
                    )}
                  />
                  {signal.label}
                </span>
              ))}
            </div>
          )}

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

          {hasData && (
            <button
              type="button"
              onClick={scrollToLectura}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              Revisar detalle →
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:min-w-[210px] lg:grid-cols-1">
          <div className="rounded-2xl border border-border bg-muted/40 p-4">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Tasa de ahorro</p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tabular-nums",
                metrics.savingsRate >= 0 ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {metrics.savingsRate}%
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/40 p-4">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Cierre estimado</p>
            <p
              className={cn(
                "mt-1 text-sm font-semibold tabular-nums",
                metrics.projection.projectedRealAvailable >= 0 ? "text-foreground" : "text-rose-400",
              )}
            >
              <SensitiveAmount value={formatMoney(metrics.projection.projectedRealAvailable, currency)} />
            </p>
          </div>
          {usdBalance && usdBalance.accountCount > 0 ? (
            <div className="col-span-2 rounded-2xl border border-sky-300/16 bg-sky-300/[0.045] p-4 lg:col-span-1">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Dólares</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-sky-400">
                <SensitiveAmount value={formatMoney(usdBalance.amount, "USD")} />
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {usdBalance.accountCount} cuenta{usdBalance.accountCount !== 1 ? "s" : ""} en USD
              </p>
              {fxLoaded && (
                <p className="mt-1.5 text-[10px] text-muted-foreground/70">
                  ≈ <SensitiveAmount value={formatMoney(fxEstimate(usdBalance.amount, "USD", "ARS", fxRate) ?? 0)} /> estimado
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </PremiumCard>
  );
}
