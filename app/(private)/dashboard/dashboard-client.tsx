"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowLeftCircle,
  ArrowRightCircle,
  ArrowUpCircle,
  CreditCard,
  Lightbulb,
  Loader2,
  Lock,
  Plus,
  ReceiptText,
  Sparkles,
  Wallet,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { StatCard } from "@/components/app/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    totalOutstandingDebt: number;
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

/* ── Animated counter ───────────────────────────────────────────────────── */

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

/* ── Hero card ──────────────────────────────────────────────────────────── */

function HeroCard({
  metrics,
  year,
  month,
}: {
  metrics: DashboardSummary["metrics"];
  year: number;
  month: number;
}) {
  const animated = useCountUp(metrics.realAvailable);

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-violet-500/28 p-6 sm:p-7"
      style={{ background: "linear-gradient(135deg, rgba(124,58,237,.22) 0%, rgba(99,102,241,.08) 60%, rgba(15,17,30,.9) 100%)" }}>
      {/* Glow blob */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,.3) 0%, transparent 70%)" }} />
      {/* Top border gradient */}
      <div className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: "linear-gradient(90deg,#7c3aed,#6366f1,transparent)" }} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-violet-400/80">
              Dinero disponible real
            </span>
            <span className="rounded-full border border-violet-500/20 bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-violet-300">
              {MONTH_NAMES[month - 1]} {year}
            </span>
          </div>
          <p className="mb-5 text-[40px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">
            {formatMoney(animated)}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
            <FormulaPill label="Ingresos" value={metrics.income} color="#34d399" href="/transactions?type=INCOME" />
            <span aria-hidden="true">−</span>
            <FormulaPill label="Gastos" value={metrics.expenses} color="#f87171" href="/transactions?type=EXPENSE" />
            <span aria-hidden="true">−</span>
            <FormulaPill label="Reservado" value={metrics.remainingReservedBudget} color="#fbbf24" href="/budgets" />
            <span aria-hidden="true">−</span>
            <FormulaPill label="Obligaciones" value={metrics.upcomingObligations} color="#60a5fa" href="/recurring" />
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-white/40">Tasa de ahorro</p>
          <p className="text-[28px] font-bold text-emerald-400">{metrics.savingsRate}%</p>
        </div>
      </div>
    </div>
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
      className="flex min-w-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 transition hover:bg-white/5"
      aria-label={label}
    >
      <span className="text-xs text-white/50">{label}</span>
      <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>{formatMoney(value)}</span>
    </Link>
  );
}

/* ── Monthly signals ───────────────────────────────────────────────────── */

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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Señales del mes</CardTitle>
        <CardDescription>Prioridades y próximos pasos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`rounded-xl border p-3 ${primaryTone.shell}`}>
          <div className="flex items-start gap-2.5">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${primaryTone.icon}`}>
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className={`text-[11px] font-semibold uppercase tracking-wider ${primaryTone.label}`}>
                Consejo
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
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition hover:border-primary/35 hover:bg-secondary/50"
              >
                <Sparkles className={`h-3.5 w-3.5 shrink-0 ${tone.label}`} aria-hidden="true" />
                <span className="truncate font-medium">{insight.title}</span>
              </Link>
            );
          })}
          {alerts.slice(0, 2).map((alert) => (
            <div key={alert} className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
              <p className="text-xs leading-5 text-muted-foreground">{alert}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${isIncome ? "bg-emerald-500/13 text-emerald-400" : "bg-rose-500/13 text-rose-400"}`}>
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

/* ── Main component ─────────────────────────────────────────────────────── */

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
      } catch {
        setError("Error de red. Verificá tu conexión e intentá de nuevo.");
      } finally {
        setIsLoading(false);
      }
    }
    void loadSummary();
  }, [year, month]);

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
        <button type="button" onClick={navigatePrev}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
          aria-label="Mes anterior">
          <ArrowLeftCircle className="h-4 w-4" aria-hidden="true" />
        </button>
        <h2 className="flex-1 text-center text-[17px] font-bold text-foreground">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <button type="button" onClick={navigateNext} disabled={isCurrentMonth}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground transition-colors hover:bg-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Mes siguiente">
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
        <Card>
          <CardContent className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Cargando métricas financieras
          </CardContent>
        </Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        {monthNav}
        <Card>
          <CardContent className="flex h-72 flex-col items-center justify-center p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">No se pudo cargar el dashboard</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
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
  const selectedExpenseCategoryId = selectedExpenseCategoryPreference
    && expensesByCategory.some((category) => category.id === selectedExpenseCategoryPreference)
    ? selectedExpenseCategoryPreference
    : expensesByCategory[0]?.id ?? null;
  const selectedExpenseCategory = expenseCategoryDetails.find((category) => category.id === selectedExpenseCategoryId)
    ?? expenseCategoryDetails[0];

  return (
    <div className="fade-in">
      {monthNav}

      {/* Hero card */}
      <HeroCard metrics={metrics} year={year} month={month} />

      {/* Stat cards */}
      <section className="stagger-in mb-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ingresos del mes" value={formatMoney(metrics.income)}
          detail="↑ transacciones de ingreso" icon={ArrowUpCircle} tone="positive"
          rawValue={metrics.income} formatter={formatMoney} href="/transactions?type=INCOME" />
        <StatCard label="Gastos del mes" value={formatMoney(metrics.expenses)}
          detail="transacciones tipo gasto" icon={ArrowDownCircle} tone="danger"
          rawValue={metrics.expenses} formatter={formatMoney} href="/transactions?type=EXPENSE" />
        <StatCard label="Presupuesto reservado" value={formatMoney(metrics.remainingReservedBudget)}
          detail="pendiente de gastar" icon={Lock} tone="warning"
          rawValue={metrics.remainingReservedBudget} formatter={formatMoney} href="/budgets" />
        <StatCard label="Obligaciones del mes" value={formatMoney(metrics.upcomingObligations)}
          detail="recurrentes, metas y deuda" icon={CreditCard}
          tone={metrics.upcomingObligations === 0 ? "positive" : "warning"}
          rawValue={metrics.upcomingObligations} formatter={formatMoney} href="/recurring" />
      </section>

      {/* Charts row */}
      <section className="mb-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Expense donut */}
        <Card>
          <CardHeader>
            <CardTitle>Gastos por categoría</CardTitle>
            <CardDescription>Suma real de gastos del mes.</CardDescription>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length === 0 ? (
              <EmptyState icon={ReceiptText} title="Sin gastos este mes"
                description="Los gastos agrupados aparecerán al registrar transacciones." />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-center">
                  <ExpenseCategoryChart
                    data={expensesByCategory}
                    activeCategoryId={selectedExpenseCategoryId ?? undefined}
                    onSelectCategory={setSelectedExpenseCategoryPreference}
                  />
                  <div className="space-y-2">
                    {expensesByCategory.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-secondary ${selectedExpenseCategoryId === item.id ? "bg-secondary" : ""}`}
                        onClick={() => setSelectedExpenseCategoryPreference(item.id)}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: item.color }} />
                          <span className="truncate text-muted-foreground">{item.name}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-semibold tabular-nums">{formatMoney(item.value)}</span>
                          <span className="block text-[10px] text-muted-foreground">
                            {metrics.expenses > 0 ? Math.round((item.value / metrics.expenses) * 100) : 0}%
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                {selectedExpenseCategory ? (
                  <div className="mt-4 rounded-lg border border-border bg-background/35 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{selectedExpenseCategory.name}</p>
                        <p className="text-xs text-muted-foreground">{selectedExpenseCategory.items.length} movimiento{selectedExpenseCategory.items.length !== 1 ? "s" : ""}</p>
                      </div>
                      <p className="shrink-0 text-sm font-bold tabular-nums">{formatMoney(selectedExpenseCategory.total)}</p>
                    </div>
                    <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                      {selectedExpenseCategory.items.map((item) => (
                        <Link
                          key={item.id}
                          href={`/transactions?categoryId=${selectedExpenseCategory.id}`}
                          className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition hover:bg-secondary"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium">{item.description ?? "Sin descripción"}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{item.account.name} · {formatDate(item.occurredAt)}</span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-rose-400">-{formatMoney(item.amount, item.currency as "ARS" | "USD")}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {/* Signals + financial summary */}
        <div className="flex flex-col gap-5">
          <MonthlySignals insights={insights} alerts={alerts} />

          {/* Savings & metas summary */}
          <div className="grid grid-cols-2 gap-3.5">
            <Link href="/goals" className="rounded-xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/35">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                <Wallet className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ahorro est.</p>
              <p className="mt-1 text-base font-bold text-emerald-400 tabular-nums">
                {formatMoney(metrics.estimatedSavings)}
              </p>
            </Link>
            <Link href="/debts" className="rounded-xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/35">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Deuda total</p>
              <p className="mt-1 text-base font-bold text-muted-foreground tabular-nums">
                {formatMoney(metrics.totalOutstandingDebt)}
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Recent transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Últimas transacciones</CardTitle>
              <CardDescription>Movimientos recientes del mes.</CardDescription>
            </div>
            <Button asChild size="sm" variant="secondary" className="h-8 shrink-0">
              <Link href="/transactions">Ver todas</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <RecentTransactions transactions={latestTransactions} />
        </CardContent>
      </Card>
    </div>
  );
}
