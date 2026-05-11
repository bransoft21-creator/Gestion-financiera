"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  type LucideIcon,
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
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { FinancialAiAnalysisCard } from "@/components/dashboard/financial-ai-analysis-card";
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

const easeOut = [0.16, 1, 0.3, 1] as const;

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.02 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.48, ease: easeOut } },
};

const sectionReveal = {
  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: easeOut } },
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

/* ── Time-aware context ──────────────────────────────────────────────────── */

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

type TimeContext = {
  greeting: string;
  timeOfDay: TimeOfDay;
  isWeekend: boolean;
};

function getTimeContext(): TimeContext {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;

  let timeOfDay: TimeOfDay;
  let greeting: string;

  if (hour >= 6 && hour < 13) {
    timeOfDay = "morning";
    greeting = "Buen día, Brandon.";
  } else if (hour >= 13 && hour < 20) {
    timeOfDay = "afternoon";
    greeting = "Buenas tardes.";
  } else if (hour >= 20 && hour < 23) {
    timeOfDay = "evening";
    greeting = "Buenas noches.";
  } else {
    timeOfDay = "night";
    greeting = "Todo en calma.";
  }

  return { greeting, timeOfDay, isWeekend };
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
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

/* ── Ambient signal ──────────────────────────────────────────────────────── */

function AmbientSignal({ text, celebratory = false }: { text: string; celebratory?: boolean }) {
  return (
    <div className="mb-8 flex items-center gap-3 sm:mb-10">
      <span
        className={`h-px flex-1 ${celebratory ? "bg-emerald-500/[0.12]" : "bg-white/[0.04]"}`}
        aria-hidden="true"
      />
      <p className={`shrink-0 text-[11px] italic tracking-wide ${celebratory ? "text-emerald-500/70" : "text-zinc-600"}`}>
        {text}
      </p>
      <span
        className={`h-px flex-1 ${celebratory ? "bg-emerald-500/[0.12]" : "bg-white/[0.04]"}`}
        aria-hidden="true"
      />
    </div>
  );
}

function getAmbientHint(
  metrics: DashboardSummary["metrics"],
  timeCtx: TimeContext,
  isCurrentMonth: boolean,
): string | null {
  if (metrics.income === 0 && metrics.expenses === 0) {
    return isCurrentMonth ? "Este mes todavía está en blanco. Todo empieza desde acá." : null;
  }

  const { savingsRate, fixedToIncomeRatio, upcomingObligations, projection } = metrics;

  if (isCurrentMonth) {
    if (projection.daysRemaining <= 3) return "El mes está cerrando. Un último vistazo.";
    if (projection.daysRemaining <= 7) return "El mes está en su tramo final.";
    if (timeCtx.isWeekend && timeCtx.timeOfDay === "morning") {
      return "Los fines de semana suelen mover más los gastos. Buen momento para revisar.";
    }
    if (timeCtx.timeOfDay === "morning" && savingsRate >= 15) return "Tu situación viene estable. Buen arranque.";
    if (timeCtx.timeOfDay === "night") return "Todo lo que importa hoy está resumido acá.";
  }

  if (savingsRate >= 25) return `Guardás el ${savingsRate}% del ingreso este mes. Viene sólido.`;
  if (savingsRate >= 15) return `El ${savingsRate}% va al ahorro. Ritmo positivo.`;
  if (upcomingObligations === 0 && savingsRate >= 0) return "Sin compromisos pendientes. El mes puede cerrar limpio.";
  if (fixedToIncomeRatio < 35 && metrics.income > 0) return "Los gastos fijos están tranquilos este mes.";
  if (fixedToIncomeRatio >= 55 && metrics.income > 0) return "Los fijos están pesando. Vale revisarlos antes de fin de mes.";
  if (savingsRate < 0) return "El disponible real es negativo. El mes pide atención.";

  return "Todo lo que importa está resumido acá.";
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
    <PremiumCard variant="raised" className="relative mb-8 overflow-hidden p-5 sm:mb-10 sm:p-7">
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

/* ── Financial Insight Cards ─────────────────────────────────────────────── */

type InsightCardTone = "positive" | "warning" | "danger" | "neutral" | "info";
type InsightSignalTone = "positive" | "warning" | "neutral";

const insightCardShellConfig: Record<InsightCardTone, string> = {
  positive: "border-emerald-300/16 bg-emerald-300/[0.045]",
  warning:  "border-amber-300/16 bg-amber-300/[0.045]",
  danger:   "border-rose-300/16 bg-rose-300/[0.045]",
  neutral:  "",
  info:     "border-sky-300/16 bg-sky-300/[0.045]",
};

const insightCardIconConfig: Record<InsightCardTone, string> = {
  positive: "bg-emerald-300/12 text-emerald-100",
  warning:  "bg-amber-300/12 text-amber-100",
  danger:   "bg-rose-300/12 text-rose-100",
  neutral:  "bg-white/[0.08] text-zinc-100",
  info:     "bg-sky-300/12 text-sky-100",
};

const insightSignalTextConfig: Record<InsightSignalTone, string> = {
  positive: "text-emerald-400",
  warning:  "text-amber-400",
  neutral:  "text-zinc-500",
};

function FinancialInsightCard({
  label,
  value,
  icon: Icon,
  cardTone = "neutral",
  insight,
  insightTone = "neutral",
  href,
  featured = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  cardTone?: InsightCardTone;
  insight: string;
  insightTone?: InsightSignalTone;
  href: string;
  featured?: boolean;
}) {
  return (
    <Link href={href} className="block min-w-0 h-full">
      <PremiumCard
        interactive
        className={cn(
          "flex h-full flex-col",
          featured ? "p-5 sm:p-6" : "p-4 sm:p-5",
          insightCardShellConfig[cardTone],
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
          <div className={cn(
            "flex shrink-0 items-center justify-center rounded-xl",
            featured ? "h-9 w-9" : "h-8 w-8",
            insightCardIconConfig[cardTone],
          )}>
            <Icon className={featured ? "h-[18px] w-[18px]" : "h-4 w-4"} aria-hidden="true" />
          </div>
        </div>
        <p className={cn(
          "truncate font-semibold leading-none tabular-nums text-white",
          featured
            ? "text-[32px] sm:text-[36px] xl:text-[40px]"
            : "text-[26px] sm:text-3xl",
        )}>
          {value}
        </p>
        <div className="mt-3 flex-1 border-t border-white/[0.06] pt-3">
          <p className={cn("text-xs leading-5", insightSignalTextConfig[insightTone])}>{insight}</p>
        </div>
      </PremiumCard>
    </Link>
  );
}

type HealthSignal = { label: string; tone: "positive" | "warning" };

function buildHealthSignals(metrics: DashboardSummary["metrics"]): HealthSignal[] {
  const signals: HealthSignal[] = [];
  if (metrics.savingsRate >= 20) {
    signals.push({ label: `Ahorrás ${metrics.savingsRate}%`, tone: "positive" });
  } else if (metrics.savingsRate < 0) {
    signals.push({ label: "Mes en déficit", tone: "warning" });
  }
  if (metrics.fixedToIncomeRatio < 35 && metrics.income > 0) {
    signals.push({ label: "Fijos controlados", tone: "positive" });
  } else if (metrics.fixedToIncomeRatio >= 55 && metrics.income > 0) {
    signals.push({ label: `${metrics.fixedToIncomeRatio}% en fijos`, tone: "warning" });
  }
  if (metrics.upcomingObligations === 0 && metrics.income > 0) {
    signals.push({ label: "Sin presión pendiente", tone: "positive" });
  }
  if (metrics.projection.projectedExpenses > metrics.income * 1.05 && metrics.income > 0) {
    signals.push({ label: "Proyección supera ingresos", tone: "warning" });
  }
  return signals;
}

function FinancialHealthStrip({ metrics }: { metrics: DashboardSummary["metrics"] }) {
  const signals = buildHealthSignals(metrics);
  if (!signals.length) return null;

  return (
    <div className="mb-10 flex flex-wrap gap-1.5 sm:mb-12">
      {signals.map((signal) => (
        <div
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
        </div>
      ))}
    </div>
  );
}

function getIncomeInsight(metrics: DashboardSummary["metrics"]): {
  insight: string;
  insightTone: InsightSignalTone;
  cardTone: InsightCardTone;
} {
  if (metrics.savingsRate >= 20) {
    return {
      insight: `Tasa de ahorro del ${metrics.savingsRate}%. Vas por buen camino.`,
      insightTone: "positive",
      cardTone: "positive",
    };
  }
  if (metrics.savingsRate >= 5) {
    return {
      insight: `El ${metrics.savingsRate}% va al ahorro. Hay margen para crecer.`,
      insightTone: "neutral",
      cardTone: "neutral",
    };
  }
  if (metrics.savingsRate < 0) {
    return {
      insight: "Gastás más de lo que entra. El mes necesita ajuste.",
      insightTone: "warning",
      cardTone: "danger",
    };
  }
  return {
    insight: "Base del mes. Todo lo demás se mide desde este número.",
    insightTone: "neutral",
    cardTone: "neutral",
  };
}

function getExpensesInsight(metrics: DashboardSummary["metrics"]): {
  insight: string;
  insightTone: InsightSignalTone;
  cardTone: InsightCardTone;
} {
  if (metrics.spendingRate === 0) {
    return { insight: "El mes todavía está en blanco.", insightTone: "neutral", cardTone: "neutral" };
  }
  if (metrics.spendingRate >= 100) {
    return {
      insight: `${metrics.spendingRate}% del ingreso consumido. Superaste el límite del mes.`,
      insightTone: "warning",
      cardTone: "danger",
    };
  }
  if (metrics.spendingRate >= 85) {
    return {
      insight: `${metrics.spendingRate}% gastado. Margen muy ajustado para lo que queda.`,
      insightTone: "warning",
      cardTone: "warning",
    };
  }
  if (metrics.spendingRate >= 65) {
    return {
      insight: `${metrics.spendingRate}% del ingreso en movimiento. Ritmo activo.`,
      insightTone: "neutral",
      cardTone: "neutral",
    };
  }
  return {
    insight: `Vas con margen. El ${metrics.spendingRate}% del ingreso en movimiento.`,
    insightTone: "positive",
    cardTone: "neutral",
  };
}

function getReservedInsight(metrics: DashboardSummary["metrics"]): {
  insight: string;
  insightTone: InsightSignalTone;
  cardTone: InsightCardTone;
} {
  if (metrics.remainingReservedBudget === 0) {
    return {
      insight: "Sin presupuesto pendiente. Tus categorías están al día.",
      insightTone: "positive",
      cardTone: "positive",
    };
  }
  const reservedRatio = metrics.income > 0
    ? Math.round((metrics.remainingReservedBudget / metrics.income) * 100)
    : 0;
  if (reservedRatio >= 30) {
    return {
      insight: `El ${reservedRatio}% del ingreso está bloqueado en presupuestos activos.`,
      insightTone: "warning",
      cardTone: "warning",
    };
  }
  return {
    insight: "Dinero comprometido para categorías con presupuesto activo.",
    insightTone: "neutral",
    cardTone: "neutral",
  };
}

function getObligationsInsight(metrics: DashboardSummary["metrics"]): {
  insight: string;
  insightTone: InsightSignalTone;
  cardTone: InsightCardTone;
} {
  if (metrics.upcomingObligations === 0) {
    return {
      insight: "Sin compromisos pendientes. El mes puede cerrar limpio.",
      insightTone: "positive",
      cardTone: "positive",
    };
  }
  if (metrics.realAvailable < 0) {
    return {
      insight: "El disponible real ya es negativo antes de cubrir los compromisos.",
      insightTone: "warning",
      cardTone: "danger",
    };
  }
  if (metrics.upcomingObligations > metrics.realAvailable * 0.5) {
    return {
      insight: "Los compromisos consumen más de la mitad del disponible real.",
      insightTone: "warning",
      cardTone: "warning",
    };
  }
  return {
    insight: "Compromisos cubiertos por el disponible actual. Sin tensión.",
    insightTone: "neutral",
    cardTone: "neutral",
  };
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
    <PremiumCard className="flex h-full flex-col">
      <PremiumCardContent className="flex h-full flex-col space-y-3 pt-5 sm:pt-6">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          <Lightbulb className="h-3 w-3 shrink-0" aria-hidden="true" />
          Lo que importa hoy
        </div>
        <div className={`flex-1 rounded-2xl border p-4 ${primaryTone.shell}`}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${primaryTone.icon}`}>
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight text-white">{signal.title}</h3>
              <p className="mt-1.5 text-xs leading-5 text-zinc-400">{signal.message}</p>
              <Button asChild size="sm" variant="ghost" className="mt-2 h-7 px-0 text-xs text-zinc-500 hover:bg-transparent hover:text-white">
                <Link href={signal.href}>{signal.actionLabel} →</Link>
              </Button>
            </div>
          </div>
        </div>

        {secondary.length > 0 && (
          <div className="space-y-1">
            {secondary.slice(0, 2).map((insight) => {
              const tone = insightToneConfig[insight.tone];
              return (
                <Link
                  key={`${insight.title}-${insight.href}`}
                  href={insight.href}
                  className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs text-zinc-600 transition hover:bg-white/[0.04] hover:text-zinc-300"
                >
                  <Sparkles className={`h-3 w-3 shrink-0 ${tone.label}`} aria-hidden="true" />
                  <span className="truncate">{insight.title}</span>
                </Link>
              );
            })}
          </div>
        )}
        {alerts.slice(0, 1).map((alert) => (
          <div key={alert} className="flex gap-2 rounded-xl border border-amber-500/12 bg-amber-500/[0.07] px-3 py-2">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-hidden="true" />
            <p className="text-xs leading-5 text-zinc-500">{alert}</p>
          </div>
        ))}
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
          <p className="py-2 text-center text-xs text-muted-foreground">Este mes todavía está tranquilo por acá.</p>
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
              title="El mes todavía está en blanco"
              description="Tu mapa de consumo empieza a construirse cuando registrás el primer gasto."
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
    <EmptyState icon={ReceiptText} title="Todavía no hay movimientos" description="Cuando registrés el primero, tu timeline financiero empieza a construirse." />
  );

  return (
    <div>
      {transactions.map((tx, i) => {
        const isIncome = tx.type === "INCOME";
        return (
          <div key={tx.id}
            className={`flex items-center gap-3 py-3 ${i < transactions.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isIncome ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.06] text-zinc-400"}`}>
              {isIncome
                ? <ArrowUpCircle className="h-[15px] w-[15px]" aria-hidden="true" />
                : <ArrowDownCircle className="h-[15px] w-[15px]" aria-hidden="true" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-zinc-100">
                {tx.description ?? "Sin descripción"}
              </p>
              <p className="text-[11px] text-zinc-600">
                {tx.category?.name ?? "Sin categoría"} · {formatDate(tx.occurredAt)}
              </p>
            </div>
            <p className={`shrink-0 text-[13px] font-semibold tabular-nums ${isIncome ? "text-emerald-400" : "text-zinc-400"}`}>
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
  const [timeContext] = useState(() => getTimeContext());
  const shouldReduceMotion = useReducedMotion();

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
    <div className="mb-6">
      {isCurrentMonth && (
        <p className="mb-3 text-[11px] tracking-wide text-zinc-600" suppressHydrationWarning>
          {timeContext.greeting}
        </p>
      )}
      <div className="grid gap-3 sm:flex sm:items-center">
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
            <h2 className="mt-4 text-lg font-semibold">No pudimos traer tu información</h2>
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
        <EmptyState icon={ReceiptText} title="Todavía no hay datos para este mes" description="Cuando registres movimientos, toda la información aparece acá." />
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

  const incomeInsight = getIncomeInsight(metrics);
  const expensesInsight = getExpensesInsight(metrics);
  const reservedInsight = getReservedInsight(metrics);
  const obligationsInsight = getObligationsInsight(metrics);

  const ambientHint = getAmbientHint(metrics, timeContext, isCurrentMonth);
  const isCelebratoryMonth = isCurrentMonth && metrics.savingsRate >= 20;

  return (
    <div className="fade-in">
      {monthNav}

      {/* 1. Hero — disponible real del mes */}
      <HeroCard metrics={metrics} year={year} month={month} usdBalance={usdBalance} />

      {/* Ambient signal — puente contextual entre Hero y Copilot */}
      {ambientHint && <AmbientSignal text={ambientHint} celebratory={isCelebratoryMonth} />}

      {/* 2. Financial Copilot — protagonista, posición central */}
      <FinancialAiAnalysisCard month={selectedMonth} />

      {/* 3. Financial Insight Cards — layout editorial asimétrico */}
      <motion.section
        variants={staggerContainer}
        initial={shouldReduceMotion ? "visible" : "hidden"}
        animate="visible"
        className="mx-auto mb-6 grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr]"
      >
        <motion.div variants={shouldReduceMotion ? undefined : fadeUp} className="min-w-0">
          <FinancialInsightCard
            featured
            label="Ingresos"
            value={formatMoney(metrics.income)}
            icon={ArrowUpCircle}
            cardTone={incomeInsight.cardTone}
            insight={incomeInsight.insight}
            insightTone={incomeInsight.insightTone}
            href="/transactions?type=INCOME"
          />
        </motion.div>
        <motion.div variants={shouldReduceMotion ? undefined : fadeUp} className="min-w-0">
          <FinancialInsightCard
            label="Gastos"
            value={formatMoney(metrics.expenses)}
            icon={ArrowDownCircle}
            cardTone={expensesInsight.cardTone}
            insight={expensesInsight.insight}
            insightTone={expensesInsight.insightTone}
            href="/transactions?type=EXPENSE"
          />
        </motion.div>
        <motion.div variants={shouldReduceMotion ? undefined : fadeUp} className="min-w-0">
          <FinancialInsightCard
            label="Reservado"
            value={formatMoney(metrics.remainingReservedBudget)}
            icon={Lock}
            cardTone={reservedInsight.cardTone}
            insight={reservedInsight.insight}
            insightTone={reservedInsight.insightTone}
            href="/budgets"
          />
        </motion.div>
        <motion.div variants={shouldReduceMotion ? undefined : fadeUp} className="min-w-0">
          <FinancialInsightCard
            label="Compromisos"
            value={formatMoney(metrics.upcomingObligations)}
            icon={CreditCard}
            cardTone={obligationsInsight.cardTone}
            insight={obligationsInsight.insight}
            insightTone={obligationsInsight.insightTone}
            href="/recurring"
          />
        </motion.div>
      </motion.section>
      <FinancialHealthStrip metrics={metrics} />

      {/* 4. Distribución del gasto + tendencia del mes */}
      <motion.section
        variants={shouldReduceMotion ? undefined : sectionReveal}
        initial={shouldReduceMotion ? false : "hidden"}
        animate={shouldReduceMotion ? false : "visible"}
        transition={{ delay: 0.08 }}
        className="mx-auto mb-10 grid w-full gap-5 sm:mb-12 lg:grid-cols-2"
      >
        <ExpenseTypeBreakdown
          expensesByType={metrics.expensesByType}
          total={metrics.expenses}
          income={metrics.income}
          fixedToIncomeRatio={metrics.fixedToIncomeRatio}
        />
        <MonthProjection metrics={metrics} />
      </motion.section>

      {/* 5. Mapa de consumo + señales + contexto */}
      <motion.section
        variants={shouldReduceMotion ? undefined : sectionReveal}
        initial={shouldReduceMotion ? false : "hidden"}
        animate={shouldReduceMotion ? false : "visible"}
        transition={{ delay: 0.14 }}
        className="mx-auto mb-10 grid w-full gap-5 sm:mb-12 lg:grid-cols-[1.2fr_0.8fr]"
      >
        <ExpenseCategoryExplorer
          expensesByCategory={expensesByCategory}
          selectedExpenseCategory={selectedExpenseCategory}
          selectedExpenseCategoryId={selectedExpenseCategoryId}
          totalExpenses={metrics.expenses}
          onSelectCategory={handleExpenseCategorySelect}
        />

        <div className="flex flex-col gap-4">
          <MonthlySignals insights={insights} alerts={alerts} />

          <div className="grid grid-cols-2 gap-3">
            <Link href="/goals" className="block min-w-0">
              <PremiumCard interactive className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Ahorro est.</p>
                <p className="mt-2 text-lg font-bold tabular-nums text-emerald-400">
                  {formatMoney(metrics.estimatedSavings)}
                </p>
                <p className="mt-1 text-[10px] text-zinc-600">este mes →</p>
              </PremiumCard>
            </Link>
            <Link href="/debts" className="block min-w-0">
              <PremiumCard interactive className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Deuda total</p>
                <p className="mt-2 text-lg font-bold tabular-nums text-zinc-400">
                  {formatMoney(metrics.totalOutstandingDebt)}
                </p>
                <p className="mt-1 text-[10px] text-zinc-600">ver compromisos →</p>
              </PremiumCard>
            </Link>
          </div>
        </div>
      </motion.section>

      {/* 6. Movimientos recientes — stream, no tabla */}
      <motion.div
        variants={shouldReduceMotion ? undefined : sectionReveal}
        initial={shouldReduceMotion ? false : "hidden"}
        animate={shouldReduceMotion ? false : "visible"}
        transition={{ delay: 0.2 }}
      >
        <PremiumCard>
          <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
            <h3 className="text-sm font-semibold text-white">Movimientos recientes</h3>
            <Button asChild size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs text-zinc-600 hover:bg-transparent hover:text-zinc-200">
              <Link href="/transactions">Ver todas →</Link>
            </Button>
          </div>
          <PremiumCardContent>
            <RecentTransactions transactions={latestTransactions} />
          </PremiumCardContent>
        </PremiumCard>
      </motion.div>
    </div>
  );
}
