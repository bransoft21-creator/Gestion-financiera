"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowLeftCircle,
  ArrowRightCircle,
  ArrowUpCircle,
  ChevronLeft,
  CreditCard,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  Lock,
  Plus,
  ReceiptText,
  Repeat,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { FinancialAiAnalysisCard } from "@/components/dashboard/financial-ai-analysis-card";
import { FinanceMetricCard } from "@/components/finance/finance-metric-card";
import {
  PremiumCard,
  PremiumCardContent,
  PremiumCardDescription,
  PremiumCardHeader,
  PremiumCardTitle,
} from "@/components/ui-v2/premium-card";
import {
  ExpenseCategoryChart,
  type ExpenseCategoryChartItem,
} from "@/components/dashboard/expense-category-chart";

type DashboardSummary = {
  metrics: {
    income: number;
    expenses: number;
    balance: number;
    estimatedSavings: number;
    totalBudgeted: number;
    budgetedSpent: number;
    remainingReservedBudget: number;
    upcomingRecurringExpenses: number;
    requiredGoalContributions: number;
    upcomingDebtPayments: number;
    upcomingObligations: number;
    realAvailable: number;
    savingsRate: number;
    spendingRate: number;
    totalOutstandingDebt: number;
    accountBalances: Array<{
      currency: "ARS" | "USD" | string;
      amount: number;
      accountCount: number;
    }>;
    expensesByType: {
      fixed: number;
      variable: number;
      extraordinary: number;
      unclassified: number;
    };
    fixedToIncomeRatio: number;
    projection: {
      isCurrentMonth: boolean;
      daysInMonth: number;
      dayOfMonth: number;
      daysRemaining: number;
      projectedExpenses: number;
      projectedBalance: number;
      projectedRealAvailable: number;
    };
  };
  expensesByCategory: ExpenseCategoryChartItem[];
  expenseCategoryDetails: Array<{
    id: string;
    name: string;
    total: number;
    items: Array<{
      id: string;
      description: string | null;
      amount: number;
      currency: "ARS" | "USD" | string;
      occurredAt: string;
      account: { id: string; name: string };
    }>;
  }>;
  latestTransactions: Array<{
    id: string;
    type: "INCOME" | "EXPENSE" | string;
    currency: "ARS" | "USD";
    amount: number;
    description: string | null;
    occurredAt: string;
    account: { name: string };
    category: { name: string } | null;
  }>;
  alerts: string[];
  insights: Array<{
    title: string;
    message: string;
    tone: "positive" | "warning" | "danger" | "default";
    actionLabel: string;
    href: string;
  }>;
};

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatMoney(value: number, currency: "ARS" | "USD" = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency, maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(value));
}

/* ── Motion presets ──────────────────────────────────────────────────────── */

const easeOut = [0.22, 1, 0.36, 1] as const;

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOut } },
};

/* ── Animated counter ────────────────────────────────────────────────────── */

function useCountUp(target: number, ms = 850) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (!target) {
      raf.current = requestAnimationFrame(() => setVal(0));
      return () => cancelAnimationFrame(raf.current);
    }

    let start: number | null = null;
    const go = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start) / ms, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(go);
    };
    raf.current = requestAnimationFrame(go);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return val;
}

/* ── Dashboard skeleton ──────────────────────────────────────────────────── */

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="v2-card-raised rounded-[var(--v2-radius-xl)] p-5 sm:p-7">
        <div className="mb-4 flex gap-2">
          <div className="h-6 w-24 animate-pulse rounded-full bg-white/10" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-white/[0.06]" />
        </div>
        <div className="h-8 w-3/5 animate-pulse rounded-full bg-white/10" />
        <div className="mt-3 h-4 w-4/5 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="mt-6 h-14 w-44 animate-pulse rounded-full bg-white/10" />
        <div className="mt-5 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-7 w-24 animate-pulse rounded-full bg-white/[0.06]" />
          ))}
        </div>
      </div>
      {/* AI card */}
      <div className="overflow-hidden rounded-[var(--v2-radius-xl)] border border-white/10 bg-white/[0.025] p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-2xl bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-36 animate-pulse rounded-full bg-white/10" />
            <div className="h-3 w-52 animate-pulse rounded-full bg-white/[0.06]" />
          </div>
          <div className="h-9 w-28 animate-pulse rounded-2xl bg-white/10" />
        </div>
      </div>
      {/* Metric cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="v2-card rounded-[var(--v2-radius-lg)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2.5">
                <div className="h-2.5 w-14 animate-pulse rounded-full bg-white/10" />
                <div className="h-7 w-20 animate-pulse rounded-full bg-white/10" />
                <div className="h-2 w-28 animate-pulse rounded-full bg-white/[0.06]" />
              </div>
              <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-white/10" />
            </div>
          </div>
        ))}
      </div>
      {/* Lower sections */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="v2-card animate-pulse rounded-[var(--v2-radius-lg)] h-52" />
        <div className="v2-card animate-pulse rounded-[var(--v2-radius-lg)] h-52" />
      </div>
    </div>
  );
}

/* ── Hero card ───────────────────────────────────────────────────────────── */

function HeroCard({
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
  const statusText = isPositive
    ? "Tu mes tiene margen real después de gastos, reservas y obligaciones."
    : "Tu mes necesita atención: el disponible real queda por debajo de cero.";

  return (
    <PremiumCard variant="raised" className="relative mb-6 overflow-hidden p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(45,212,191,.18)_0%,transparent_68%)]" />
      <div className="pointer-events-none absolute bottom-[-8rem] left-[-6rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,.12)_0%,transparent_68%)]" />

      <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.07] px-2.5 py-1 text-[11px] font-semibold text-teal-100">
              Disponible real
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
              {MONTH_NAMES[month - 1]} {year}
            </span>
          </div>
          <h2 className="text-balance text-2xl font-semibold leading-tight text-white sm:text-4xl">
            {isPositive ? "Tu dinero respira este mes." : "Tu mes pide una corrección."}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{statusText}</p>
          <p className={`mt-6 text-[42px] font-semibold leading-none tracking-tight tabular-nums sm:text-[56px] ${isPositive ? "text-emerald-100" : "text-rose-100"}`}>
            {formatMoney(animated)}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-white/50">
            <FormulaPill label="Ingresos" value={metrics.income} color="#34d399" href="/transactions?type=INCOME" />
            <span aria-hidden="true">−</span>
            <FormulaPill label="Gastos" value={metrics.expenses} color="#f87171" href="/transactions?type=EXPENSE" />
            <span aria-hidden="true">−</span>
            <FormulaPill label="Reservado" value={metrics.remainingReservedBudget} color="#fbbf24" href="/budgets" />
            <span aria-hidden="true">−</span>
            <FormulaPill label="Obligaciones" value={metrics.upcomingObligations} color="#60a5fa" href="/recurring" />
          </div>

          {metrics.income > 0 && (
            <div className="mt-5 max-w-2xl border-t border-white/[0.07] pt-4">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-white/40">Ingreso consumido</span>
                <span className={
                  metrics.spendingRate >= 100 ? "font-semibold text-rose-400"
                  : metrics.spendingRate >= 80 ? "font-semibold text-amber-400"
                  : "text-white/50"
                }>
                  {metrics.spendingRate}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    metrics.spendingRate >= 100 ? "bg-rose-500"
                    : metrics.spendingRate >= 80 ? "bg-amber-500"
                    : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(metrics.spendingRate, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:min-w-[210px] lg:grid-cols-1">
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <p className="text-[11px] font-semibold uppercase text-zinc-500">Tasa de ahorro</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${metrics.savingsRate >= 0 ? "text-emerald-100" : "text-rose-100"}`}>
              {metrics.savingsRate}%
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            <p className="text-[11px] font-semibold uppercase text-zinc-500">Cierre estimado</p>
            <p className={`mt-1 text-sm font-semibold tabular-nums ${metrics.projection.projectedRealAvailable >= 0 ? "text-zinc-100" : "text-rose-100"}`}>
              {formatMoney(metrics.projection.projectedRealAvailable)}
            </p>
          </div>
          {usdBalance && usdBalance.accountCount > 0 ? (
            <div className="col-span-2 rounded-2xl border border-sky-300/16 bg-sky-300/[0.045] p-4 lg:col-span-1">
              <p className="text-[11px] font-semibold uppercase text-zinc-500">Dólares</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-sky-100">
                {formatMoney(usdBalance.amount, "USD")}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                {usdBalance.accountCount} cuenta{usdBalance.accountCount !== 1 ? "s" : ""} en USD
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </PremiumCard>
  );
}

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
      className="flex min-w-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 transition hover:bg-white/[0.07]"
      aria-label={label}
    >
      <span className="shrink-0 text-xs text-white/50">{label}</span>
      <span className="max-w-[8rem] truncate text-[13px] font-semibold tabular-nums" style={{ color }}>{formatMoney(value)}</span>
    </Link>
  );
}

/* ── Monthly signals ─────────────────────────────────────────────────────── */

const insightToneConfig = {
  default: {
    shell: "border-sky-500/20 bg-sky-500/10",
    icon: "bg-sky-500/15 text-sky-400",
    label: "text-sky-400",
  },
  positive: {
    shell: "border-emerald-500/20 bg-emerald-500/10",
    icon: "bg-emerald-500/15 text-emerald-400",
    label: "text-emerald-400",
  },
  warning: {
    shell: "border-amber-500/20 bg-amber-500/10",
    icon: "bg-amber-500/15 text-amber-400",
    label: "text-amber-400",
  },
  danger: {
    shell: "border-rose-500/20 bg-rose-500/10",
    icon: "bg-rose-500/15 text-rose-400",
    label: "text-rose-400",
  },
};

function MonthlySignals({
  insights,
  alerts,
}: {
  insights: DashboardSummary["insights"];
  alerts: string[];
}) {
  if (!insights.length && !alerts.length) return null;

  const [primary, ...secondary] = insights;
  const fallback = alerts[0]
    ? {
        title: "Revisá el mes",
        message: alerts[0],
        tone: "warning" as const,
        actionLabel: "Ver transacciones",
        href: "/transactions",
      }
    : null;
  const signal = primary ?? fallback;

  if (!signal) return null;

  const primaryTone = insightToneConfig[signal.tone];

  return (
    <PremiumCard>
      <PremiumCardHeader className="pb-2">
        <PremiumCardTitle className="text-sm">Qué importa ahora</PremiumCardTitle>
        <PremiumCardDescription>Señales clave para actuar hoy.</PremiumCardDescription>
      </PremiumCardHeader>
      <PremiumCardContent className="space-y-3">
        <div className={`rounded-2xl border p-3 ${primaryTone.shell}`}>
          <div className="flex items-start gap-2.5">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${primaryTone.icon}`}>
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className={`text-[11px] font-semibold uppercase tracking-wider ${primaryTone.label}`}>
                Atención
              </p>
              <h3 className="mt-0.5 text-sm font-bold tracking-tight">{signal.title}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{signal.message}</p>
              <Button asChild size="sm" variant="secondary" className="mt-3 h-8">
                <Link href={signal.href}>{signal.actionLabel}</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {secondary.slice(0, 2).map((insight) => {
            const tone = insightToneConfig[insight.tone];
            return (
              <Link
                key={`${insight.title}-${insight.href}`}
                href={insight.href}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-muted-foreground transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <Sparkles className={`h-3.5 w-3.5 shrink-0 ${tone.label}`} aria-hidden="true" />
                <span className="truncate font-medium">{insight.title}</span>
              </Link>
            );
          })}
          {alerts.slice(0, 2).map((alert) => (
            <div key={alert} className="flex gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
              <p className="text-xs leading-5 text-muted-foreground">{alert}</p>
            </div>
          ))}
        </div>
      </PremiumCardContent>
    </PremiumCard>
  );
}

/* ── Expense type breakdown ──────────────────────────────────────────────── */

const expenseTypeRows = [
  { key: "fixed" as const, label: "Fijos", icon: Repeat, iconBg: "bg-sky-500/15 text-sky-400", barColor: "#38bdf8" },
  { key: "variable" as const, label: "Variables", icon: ShoppingCart, iconBg: "bg-amber-500/15 text-amber-400", barColor: "#fbbf24" },
  { key: "extraordinary" as const, label: "Extraordinarios", icon: Zap, iconBg: "bg-teal-300/12 text-teal-100", barColor: "#5eead4" },
  { key: "unclassified" as const, label: "Sin clasificar", icon: HelpCircle, iconBg: "bg-secondary text-muted-foreground", barColor: "#6b7280" },
] as const;

function ExpenseTypeBreakdown({
  expensesByType,
  total,
  income,
  fixedToIncomeRatio,
}: {
  expensesByType: DashboardSummary["metrics"]["expensesByType"];
  total: number;
  income: number;
  fixedToIncomeRatio: number;
}) {
  const rows = expenseTypeRows.filter(
    (row) => row.key === "unclassified" ? expensesByType.unclassified > 0 : true,
  );

  const fixedRatioColor = fixedToIncomeRatio >= 60 ? "#f87171"
    : fixedToIncomeRatio >= 40 ? "#fbbf24"
    : "#34d399";
  const fixedRatioTextClass = fixedToIncomeRatio >= 60 ? "text-rose-400"
    : fixedToIncomeRatio >= 40 ? "text-amber-400"
    : "text-emerald-400";

  return (
    <PremiumCard>
      <PremiumCardHeader className="pb-2">
        <PremiumCardTitle className="text-sm">Distribución del gasto</PremiumCardTitle>
        <PremiumCardDescription>Cómo se divide entre fijo, variable y lo inesperado.</PremiumCardDescription>
      </PremiumCardHeader>
      <PremiumCardContent className="space-y-3">
        {income > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Presión de gastos fijos
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-2xl font-extrabold tabular-nums ${fixedRatioTextClass}`}>
                {fixedToIncomeRatio}%
              </span>
              <span className="text-xs text-muted-foreground">del ingreso comprometido en fijos</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/60">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(fixedToIncomeRatio, 100)}%`, backgroundColor: fixedRatioColor }}
              />
            </div>
          </div>
        )}
        {rows.map((row) => {
          const value = expensesByType[row.key];
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <div key={row.key} className="flex items-center gap-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${row.iconBg}`}>
                <row.icon className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-semibold tabular-nums">{formatMoney(value)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: row.barColor }}
                  />
                </div>
              </div>
              <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{pct}%</span>
            </div>
          );
        })}
        {total === 0 && (
          <p className="py-2 text-center text-xs text-muted-foreground">Sin gastos registrados este mes.</p>
        )}
      </PremiumCardContent>
    </PremiumCard>
  );
}

/* ── Month projection ────────────────────────────────────────────────────── */

function buildNarrative(metrics: DashboardSummary["metrics"]): string {
  if (metrics.income === 0 && metrics.expenses === 0) return "";
  const parts: string[] = [];
  if (metrics.income > 0) {
    parts.push(`Vas gastando ${formatMoney(metrics.expenses)} de ${formatMoney(metrics.income)}.`);
  }
  if (metrics.realAvailable >= 0) {
    const suffix = metrics.upcomingObligations > 0
      ? ", pero todavía faltan gastos recurrentes por vencer."
      : ".";
    parts.push(`Te queda disponible ${formatMoney(metrics.realAvailable)}${suffix}`);
  } else {
    parts.push("El disponible real está en negativo al contemplar las obligaciones pendientes.");
  }
  return parts.join(" ");
}

function MonthProjection({ metrics }: { metrics: DashboardSummary["metrics"] }) {
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
          <p className="text-sm leading-relaxed text-muted-foreground">{narrative}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Gasto al cierre</p>
            <p className={`mt-1 text-sm font-bold tabular-nums ${
              projection.projectedExpenses > metrics.income ? "text-rose-400" : "text-foreground"
            }`}>
              {formatMoney(projection.projectedExpenses)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Saldo proyectado</p>
            <p className={`mt-1 text-sm font-bold tabular-nums ${
              projection.projectedBalance >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}>
              {formatMoney(projection.projectedBalance)}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Quedan{" "}
          <span className="font-semibold text-foreground">{projection.daysRemaining}</span>{" "}
          día{projection.daysRemaining !== 1 ? "s" : ""} del mes · Ritmo actual:{" "}
          <span className="font-semibold text-foreground">{formatMoney(dailyRate)}</span>/día
        </p>
      </PremiumCardContent>
    </PremiumCard>
  );
}

/* ── Expense category explorer ───────────────────────────────────────────── */

function ExpenseCategoryExplorer({
  expensesByCategory,
  selectedExpenseCategory,
  selectedExpenseCategoryId,
  totalExpenses,
  onSelectCategory,
}: {
  expensesByCategory: ExpenseCategoryChartItem[];
  selectedExpenseCategory?: DashboardSummary["expenseCategoryDetails"][number];
  selectedExpenseCategoryId: string | null;
  totalExpenses: number;
  onSelectCategory: (categoryId: string) => void;
}) {
  const selectedChartItem = expensesByCategory.find((item) => item.id === selectedExpenseCategoryId);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedExpenseCategoryId) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedExpenseCategoryId]);

  return (
    <div ref={cardRef} className="scroll-mt-4">
      <PremiumCard className="overflow-hidden">
        <PremiumCardHeader>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-[11px] font-semibold text-teal-100">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Mapa de consumo
              </div>
              <PremiumCardTitle>Por dónde va el dinero</PremiumCardTitle>
              <PremiumCardDescription>Qué se llevó más y qué movimientos explican cada parte.</PremiumCardDescription>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase text-zinc-500">Total leído</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">{formatMoney(totalExpenses)}</p>
            </div>
          </div>
        </PremiumCardHeader>
        <PremiumCardContent>
          {expensesByCategory.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="Sin gastos este mes"
              description="Los gastos agrupados aparecerán al registrar transacciones."
            />
          ) : (
            <div className="mx-auto grid w-full max-w-[940px] gap-5 xl:max-w-none xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.78fr)] xl:items-start">
              <div className="min-w-0 space-y-4">
                <div className="rounded-[var(--v2-radius-xl)] border border-white/10 bg-zinc-950/70 p-4 shadow-inner shadow-black/20">
                  <ExpenseCategoryChart
                    data={expensesByCategory}
                    activeCategoryId={selectedExpenseCategoryId ?? undefined}
                    onSelectCategory={onSelectCategory}
                  />
                </div>

                {/* Mobile: swap entre lista y detalle */}
                <div className="xl:hidden">
                  {selectedExpenseCategoryId && selectedExpenseCategory ? (
                    <ExpenseCategoryDetailPanel
                      category={selectedExpenseCategory}
                      color={selectedChartItem?.color}
                      onClose={() => onSelectCategory(selectedExpenseCategoryId)}
                    />
                  ) : (
                    <div className="grid gap-2">
                      {expensesByCategory.map((item) => (
                        <ExpenseCategoryOption
                          key={item.id}
                          item={item}
                          totalExpenses={totalExpenses}
                          isActive={false}
                          onClick={() => onSelectCategory(item.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Desktop: siempre muestra la lista */}
                <div className="hidden xl:grid xl:gap-2">
                  {expensesByCategory.map((item) => (
                    <ExpenseCategoryOption
                      key={item.id}
                      item={item}
                      totalExpenses={totalExpenses}
                      isActive={selectedExpenseCategoryId === item.id}
                      onClick={() => onSelectCategory(item.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="hidden xl:block">
                {selectedExpenseCategory ? (
                  <ExpenseCategoryDetailPanel
                    category={selectedExpenseCategory}
                    color={selectedChartItem?.color}
                    elevated
                  />
                ) : null}
              </div>
            </div>
          )}
        </PremiumCardContent>
      </PremiumCard>
    </div>
  );
}

function ExpenseCategoryOption({
  item,
  totalExpenses,
  isActive,
  onClick,
}: {
  item: ExpenseCategoryChartItem;
  totalExpenses: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const percentage = totalExpenses > 0 ? Math.round((item.value / totalExpenses) * 100) : 0;

  return (
    <button
      type="button"
      className={`group w-full rounded-2xl border p-3 text-left transition ${
        isActive
          ? "border-teal-300/25 bg-teal-300/[0.08] shadow-[0_18px_55px_rgba(45,212,191,0.08)]"
          : "border-white/10 bg-zinc-950/55 hover:border-white/20 hover:bg-zinc-900/75"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="h-10 w-1.5 shrink-0 rounded-full shadow-[0_0_24px_currentColor]"
            style={{ backgroundColor: item.color, color: item.color }}
          />
          <span className="min-w-0">
            <span className={`block truncate text-sm font-semibold ${isActive ? "text-white" : "text-zinc-200"}`}>
              {item.name}
            </span>
            <span className="mt-1 block text-xs text-zinc-500">{percentage}% del gasto del mes</span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums text-white">{formatMoney(item.value)}</span>
          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${isActive ? "bg-teal-300/15 text-teal-100" : "bg-white/[0.06] text-zinc-500"}`}>
            {isActive ? "Cerrar" : "Ver detalle"}
          </span>
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: item.color }}
        />
      </div>
    </button>
  );
}

function ExpenseCategoryDetailPanel({
  category,
  color,
  elevated = false,
  onClose,
}: {
  category: DashboardSummary["expenseCategoryDetails"][number];
  color?: string;
  elevated?: boolean;
  onClose?: () => void;
}) {
  return (
    <div className={`rounded-[var(--v2-radius-xl)] border border-white/[0.14] bg-zinc-950 p-4 ${elevated ? "shadow-[0_24px_80px_rgba(0,0,0,0.42)]" : ""}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-zinc-400 transition hover:bg-white/[0.14] hover:text-white"
                aria-label="Volver a categorías"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: color ?? "hsl(var(--v2-brand))" }}
            />
            <p className="text-[11px] font-semibold uppercase text-zinc-500">Movimientos de categoría</p>
          </div>
          <h3 className="truncate text-lg font-semibold text-white">{category.name}</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {category.items.length} movimiento{category.items.length !== 1 ? "s" : ""} explican este total.
          </p>
        </div>
        <p className="shrink-0 text-right text-base font-semibold tabular-nums text-white">{formatMoney(category.total)}</p>
      </div>

      <div className="space-y-2 pr-1 xl:max-h-[360px] xl:overflow-y-auto">
        {category.items.map((item) => (
          <Link
            key={item.id}
            href={`/transactions?categoryId=${category.id}`}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-900 px-3 py-2.5 transition hover:border-white/20 hover:bg-zinc-800"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-zinc-100">{item.description ?? "Sin descripción"}</span>
              <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{item.account.name} · {formatDate(item.occurredAt)}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-semibold tabular-nums text-rose-300">-{formatMoney(item.amount, item.currency as "ARS" | "USD")}</span>
              <ExternalLink className="h-3.5 w-3.5 text-zinc-600 transition group-hover:text-zinc-300" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── Recent transactions ─────────────────────────────────────────────────── */

function RecentTransactions({ transactions }: { transactions: DashboardSummary["latestTransactions"] }) {
  if (!transactions.length) return (
    <EmptyState icon={ReceiptText} title="Sin transacciones recientes" description="Registrá la primera transacción del mes." />
  );

  return (
    <div>
      {transactions.map((tx, i) => {
        const isIncome = tx.type === "INCOME";
        return (
          <div key={tx.id}
            className={`flex items-center gap-3 py-2.5 ${i < transactions.length - 1 ? "border-b border-white/[0.05]" : ""}`}>
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isIncome ? "bg-emerald-500/13 text-emerald-400" : "bg-rose-500/13 text-rose-400"}`}>
              {isIncome
                ? <ArrowUpCircle className="h-[17px] w-[17px]" aria-hidden="true" />
                : <ArrowDownCircle className="h-[17px] w-[17px]" aria-hidden="true" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">
                {tx.description ?? "Sin descripción"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {tx.category?.name ?? "Sin categoría"} · {formatDate(tx.occurredAt)}
              </p>
            </div>
            <p className={`shrink-0 text-[13px] font-bold tabular-nums ${isIncome ? "text-emerald-400" : "text-rose-400"}`}>
              {isIncome ? "+" : "−"}{formatMoney(tx.amount, tx.currency)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */

export function DashboardClient() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [selectedExpenseCategoryPreference, setSelectedExpenseCategoryPreference] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  useEffect(() => {
    async function loadSummary() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ year: String(year), month: String(month) });
        const response = await fetch(`/api/dashboard/summary?${params.toString()}`);
        const payload = (await response.json()) as { data?: DashboardSummary; error?: string };
        if (!response.ok) { setError(payload.error ?? "No se pudo cargar el dashboard."); return; }
        setSummary(payload.data ?? null);

        if (isCurrentMonth) {
          const prevMonth = month === 1 ? 12 : month - 1;
          const prevYear = month === 1 ? year - 1 : year;
          void fetch("/api/snapshots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ year: prevYear, month: prevMonth }),
          });
        }
      } catch {
        setError("Error de red. Verificá tu conexión e intentá de nuevo.");
      } finally {
        setIsLoading(false);
      }
    }
    void loadSummary();
  }, [year, month, isCurrentMonth]);

  function navigatePrev() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }

  function navigateNext() {
    if (isCurrentMonth) return;
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  const monthNav = (
    <div className="mb-6 grid gap-3 sm:flex sm:items-center">
      <div className="flex items-center gap-3 sm:flex-1">
        <button
          type="button"
          onClick={navigatePrev}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-muted-foreground transition-colors hover:bg-white/[0.10] hover:text-foreground"
          aria-label="Mes anterior"
        >
          <ArrowLeftCircle className="h-4 w-4" aria-hidden="true" />
        </button>
        <h2 className="flex-1 text-center text-[17px] font-bold text-foreground">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <button
          type="button"
          onClick={navigateNext}
          disabled={isCurrentMonth}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-muted-foreground transition-colors hover:bg-white/[0.10] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Mes siguiente"
        >
          <ArrowRightCircle className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <Button asChild size="sm" className="h-9 w-full sm:w-auto">
        <Link href="/transactions?new=1">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva transacción
        </Link>
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <>
        {monthNav}
        <DashboardSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <>
        {monthNav}
        <PremiumCard>
          <PremiumCardContent className="flex h-72 flex-col items-center justify-center p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">No se pudo cargar el dashboard</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </PremiumCardContent>
        </PremiumCard>
      </>
    );
  }

  if (!summary) {
    return (
      <>
        {monthNav}
        <EmptyState icon={ReceiptText} title="Sin datos disponibles" description="No se pudo obtener información del dashboard." />
      </>
    );
  }

  const { metrics, expensesByCategory, expenseCategoryDetails, latestTransactions, alerts, insights } = summary;
  const selectedMonth = `${year}-${String(month).padStart(2, "0")}`;
  const selectedExpenseCategoryId = selectedExpenseCategoryPreference
    && expensesByCategory.some((category) => category.id === selectedExpenseCategoryPreference)
    ? selectedExpenseCategoryPreference
    : null;
  const selectedExpenseCategory = expenseCategoryDetails.find((category) => category.id === selectedExpenseCategoryId)
    ?? undefined;
  const usdBalance = metrics.accountBalances.find((balance) => balance.currency === "USD");

  function handleExpenseCategorySelect(categoryId: string) {
    setSelectedExpenseCategoryPreference((current) => current === categoryId ? null : categoryId);
  }

  return (
    <div className="fade-in">
      {monthNav}

      {/* 1. Hero — disponible real del mes */}
      <HeroCard metrics={metrics} year={year} month={month} usdBalance={usdBalance} />

      {/* 2. Financial Copilot — protagonista, posición central */}
      <FinancialAiAnalysisCard month={selectedMonth} />

      {/* 3. Métricas del mes con stagger */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="mx-auto mb-6 grid w-full gap-3.5 sm:grid-cols-2 xl:grid-cols-5"
      >
        <motion.div variants={fadeUp} className="min-w-0">
          <Link href="/transactions?type=INCOME" className="block">
            <FinanceMetricCard
              label="Entró"
              value={formatMoney(metrics.income)}
              detail="Ingresos del mes"
              icon={ArrowUpCircle}
              tone="positive"
              trend="up"
              trendLabel="Base para tu plan mensual"
            />
          </Link>
        </motion.div>
        <motion.div variants={fadeUp} className="min-w-0">
          <Link href="/transactions?type=EXPENSE" className="block">
            <FinanceMetricCard
              label="Salió"
              value={formatMoney(metrics.expenses)}
              detail="Gastos registrados"
              icon={ArrowDownCircle}
              tone="danger"
              trend="down"
              trendLabel={`${metrics.spendingRate}% del ingreso consumido`}
            />
          </Link>
        </motion.div>
        <motion.div variants={fadeUp} className="min-w-0">
          <Link href="/budgets" className="block">
            <FinanceMetricCard
              label="Reservado"
              value={formatMoney(metrics.remainingReservedBudget)}
              detail="Presupuesto pendiente"
              icon={Lock}
              tone="warning"
              trendLabel="Dinero protegido para categorías"
            />
          </Link>
        </motion.div>
        <motion.div variants={fadeUp} className="min-w-0">
          <Link href="/recurring" className="block">
            <FinanceMetricCard
              label="Compromisos"
              value={formatMoney(metrics.upcomingObligations)}
              detail="Recurrentes, metas y deuda"
              icon={CreditCard}
              tone={metrics.upcomingObligations === 0 ? "positive" : "warning"}
              trendLabel={metrics.upcomingObligations === 0 ? "Sin presión pendiente" : "Todavía impactan el cierre"}
            />
          </Link>
        </motion.div>
        <motion.div variants={fadeUp} className="min-w-0 sm:col-span-2 xl:col-span-1">
          <Link href="/accounts" className="block">
            <FinanceMetricCard
              label="Dólares"
              value={formatMoney(usdBalance?.amount ?? 0, "USD")}
              detail={`${usdBalance?.accountCount ?? 0} cuenta${(usdBalance?.accountCount ?? 0) !== 1 ? "s" : ""} en USD`}
              icon={Wallet}
              tone="info"
              trendLabel="Saldo separado por moneda"
            />
          </Link>
        </motion.div>
      </motion.section>

      {/* 4. Distribución del gasto + tendencia del mes */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut, delay: 0.1 }}
        className="mx-auto mb-6 grid w-full gap-5 lg:grid-cols-2"
      >
        <ExpenseTypeBreakdown
          expensesByType={metrics.expensesByType}
          total={metrics.expenses}
          income={metrics.income}
          fixedToIncomeRatio={metrics.fixedToIncomeRatio}
        />
        <MonthProjection metrics={metrics} />
      </motion.section>

      {/* 5. Mapa de consumo + señales + mini-cards */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut, delay: 0.15 }}
        className="mx-auto mb-6 grid w-full gap-5 lg:grid-cols-[1.2fr_0.8fr]"
      >
        <ExpenseCategoryExplorer
          expensesByCategory={expensesByCategory}
          selectedExpenseCategory={selectedExpenseCategory}
          selectedExpenseCategoryId={selectedExpenseCategoryId}
          totalExpenses={metrics.expenses}
          onSelectCategory={handleExpenseCategorySelect}
        />

        <div className="flex flex-col gap-5">
          <MonthlySignals insights={insights} alerts={alerts} />

          <div className="grid grid-cols-2 gap-3.5">
            <Link href="/goals" className="block min-w-0">
              <PremiumCard interactive className="p-4">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ahorro est.</p>
                <p className="mt-1 text-base font-bold text-emerald-400 tabular-nums">
                  {formatMoney(metrics.estimatedSavings)}
                </p>
              </PremiumCard>
            </Link>
            <Link href="/debts" className="block min-w-0">
              <PremiumCard interactive className="p-4">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-2xl bg-white/[0.08] text-zinc-300">
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Deuda total</p>
                <p className="mt-1 text-base font-bold text-muted-foreground tabular-nums">
                  {formatMoney(metrics.totalOutstandingDebt)}
                </p>
              </PremiumCard>
            </Link>
          </div>
        </div>
      </motion.section>

      {/* 6. Movimientos recientes */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOut, delay: 0.2 }}
      >
        <PremiumCard>
          <PremiumCardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <PremiumCardTitle>Movimientos recientes</PremiumCardTitle>
                <PremiumCardDescription>Lo último que pasó en tus cuentas.</PremiumCardDescription>
              </div>
              <Button asChild size="sm" variant="secondary" className="h-8 shrink-0">
                <Link href="/transactions">Ver todas</Link>
              </Button>
            </div>
          </PremiumCardHeader>
          <PremiumCardContent>
            <RecentTransactions transactions={latestTransactions} />
          </PremiumCardContent>
        </PremiumCard>
      </motion.div>
    </div>
  );
}
