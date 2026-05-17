"use client";

import Link from "next/link";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { useCountUp } from "@/hooks/use-count-up";
import { useFxRate } from "@/hooks/use-fx-rate";
import { fxEstimate } from "@/lib/fx";
import {
  PremiumCard,
} from "@/components/ui-v2/premium-card";
import { formatMoney, MONTH_NAMES } from "@/app/(private)/dashboard/utils";
import type { DashboardSummary } from "@/app/(private)/dashboard/types";

function FormulaPill({
  label,
  value,
  color,
  href,
}: {
  label: string;
  value: number;
  color: string;
  href: string;
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
        <SensitiveAmount value={formatMoney(value)} />
      </span>
    </Link>
  );
}

export function DashboardHero({
  metrics,
  year,
  month,
  usdBalance,
}: {
  metrics: DashboardSummary["metrics"];
  year: number;
  month: number;
  usdBalance?: { amount: number; accountCount: number };
}) {
  const animated = useCountUp(metrics.realAvailable);
  const isPositive = metrics.realAvailable >= 0;
  const { rate: fxRate, loaded: fxLoaded } = useFxRate();

  return (
    <PremiumCard data-tutorial="dashboard-hero" variant="raised" className="relative mb-8 overflow-hidden p-5 sm:mb-10 sm:p-7">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(45,212,191,.18)_0%,transparent_68%)]" />
      <div className="pointer-events-none absolute bottom-[-8rem] left-[-6rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,.12)_0%,transparent_68%)]" />

      <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              Disponible real
            </span>
            <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              {MONTH_NAMES[month - 1]} {year}
            </span>
          </div>
          <h2 className="text-balance text-2xl font-semibold leading-tight text-foreground sm:text-4xl">
            {isPositive ? "Tu dinero respira este mes." : "Tu mes pide una corrección."}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {isPositive
              ? "Tu mes tiene margen real después de gastos, reservas y obligaciones."
              : "Tu mes necesita atención: el disponible real queda por debajo de cero."}
          </p>
          <p
            className={`mt-6 text-[42px] font-semibold leading-none tracking-tight tabular-nums sm:text-[56px] ${
              isPositive ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            <SensitiveAmount value={formatMoney(animated)} />
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <FormulaPill label="Ingresos" value={metrics.income} color="#34d399" href="/transactions?type=INCOME" />
            <span aria-hidden="true">−</span>
            <FormulaPill label="Gastos" value={metrics.expenses} color="#f87171" href="/transactions?type=EXPENSE" />
            <span aria-hidden="true">−</span>
            <FormulaPill label="Reservado" value={metrics.remainingReservedBudget} color="#fbbf24" href="/budgets" />
            <span aria-hidden="true">−</span>
            <FormulaPill label="Obligaciones" value={metrics.upcomingObligations} color="#60a5fa" href="/recurring" />
          </div>

          {metrics.income > 0 && (
            <div className="mt-5 max-w-2xl border-t border-border pt-4">
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
                  className={`h-full rounded-full transition-all duration-700 ${
                    metrics.spendingRate >= 100
                      ? "bg-rose-500"
                      : metrics.spendingRate >= 80
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(metrics.spendingRate, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:min-w-[210px] lg:grid-cols-1">
          <div className="rounded-2xl border border-border bg-muted/40 p-4">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Tasa de ahorro</p>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums ${
                metrics.savingsRate >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {metrics.savingsRate}%
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/40 p-4">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Cierre estimado</p>
            <p
              className={`mt-1 text-sm font-semibold tabular-nums ${
                metrics.projection.projectedRealAvailable >= 0 ? "text-foreground" : "text-rose-400"
              }`}
            >
              <SensitiveAmount value={formatMoney(metrics.projection.projectedRealAvailable)} />
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
