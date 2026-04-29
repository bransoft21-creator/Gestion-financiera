"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowLeftCircle,
  ArrowRightCircle,
  ArrowUpCircle,
  CreditCard,
  Loader2,
  Lock,
  ReceiptText,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/app/empty-state";
import { StatCard } from "@/components/app/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

function HeroCard({ metrics }: { metrics: DashboardSummary["metrics"] }) {
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
              {MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()}
            </span>
          </div>
          <p className="mb-5 text-[40px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">
            {formatMoney(animated)}
          </p>
          <div className="flex flex-wrap gap-5">
            <MiniStat label="Ingresos" value={metrics.income} color="#34d399" icon={<ArrowUpCircle className="h-3.5 w-3.5" />} />
            <MiniStat label="Gastos" value={metrics.expenses} color="#f87171" icon={<ArrowDownCircle className="h-3.5 w-3.5" />} />
            <MiniStat label="Reservado" value={metrics.remainingReservedBudget} color="#fbbf24" icon={<Lock className="h-3.5 w-3.5" />} />
            <MiniStat label="Obligaciones" value={metrics.upcomingObligations} color="#60a5fa" icon={<CreditCard className="h-3.5 w-3.5" />} />
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

function MiniStat({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color }}>{icon}</span>
      <span className="text-xs text-white/50">{label}</span>
      <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>{formatMoney(value)}</span>
    </div>
  );
}

/* ── Alerts strip ───────────────────────────────────────────────────────── */

function AlertsStrip({ alerts }: { alerts: string[] }) {
  if (!alerts.length) return null;
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {alerts.map((alert) => (
        <div key={alert}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[12px] font-medium text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
          {alert}
        </div>
      ))}
    </div>
  );
}

/* ── Trend chart ────────────────────────────────────────────────────────── */

type TrendPoint = { label: string; income: number; expenses: number };

function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Tendencia mensual</CardTitle>
        <CardDescription>Últimos meses</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#34d399" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f87171" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12 }}
              formatter={(value, name) => [
                formatMoney(Number(value ?? 0)),
                name === "income" ? "Ingresos" : "Gastos",
              ]}
            />
            <Area type="monotone" dataKey="income" stroke="#34d399" strokeWidth={2} fill="url(#gIncome)"
              dot={false} activeDot={{ r: 4, fill: "#34d399" }} />
            <Area type="monotone" dataKey="expenses" stroke="#f87171" strokeWidth={2} fill="url(#gExpense)"
              dot={false} activeDot={{ r: 4, fill: "#f87171" }} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-3 flex gap-5">
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-6 rounded bg-emerald-400" />
            <span className="text-xs text-muted-foreground">Ingresos</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-6 rounded bg-rose-400" />
            <span className="text-xs text-muted-foreground">Gastos</span>
          </div>
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
    <div className="mb-6 flex items-center gap-3">
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

  const { metrics, expensesByCategory, latestTransactions, alerts } = summary;

  /* Trend data from category chart — we don't have historical yet, show last point */
  const trendData: TrendPoint[] = [
    { label: MONTH_NAMES[month - 1].slice(0, 3), income: metrics.income, expenses: metrics.expenses },
  ];

  return (
    <div className="fade-in">
      {monthNav}

      {/* Alerts strip */}
      <AlertsStrip alerts={alerts} />

      {/* Hero card */}
      <HeroCard metrics={metrics} />

      {/* Stat cards */}
      <section className="stagger-in mb-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ingresos del mes" value={formatMoney(metrics.income)}
          detail="↑ transacciones de ingreso" icon={ArrowUpCircle} tone="positive"
          rawValue={metrics.income} formatter={formatMoney} />
        <StatCard label="Gastos del mes" value={formatMoney(metrics.expenses)}
          detail="transacciones tipo gasto" icon={ArrowDownCircle} tone="danger"
          rawValue={metrics.expenses} formatter={formatMoney} />
        <StatCard label="Presupuesto reservado" value={formatMoney(metrics.remainingReservedBudget)}
          detail="pendiente de gastar" icon={Lock} tone="warning"
          rawValue={metrics.remainingReservedBudget} formatter={formatMoney} />
        <StatCard label="Obligaciones del mes" value={formatMoney(metrics.upcomingObligations)}
          detail="recurrentes, metas y deuda" icon={CreditCard}
          tone={metrics.upcomingObligations === 0 ? "positive" : "warning"}
          rawValue={metrics.upcomingObligations} formatter={formatMoney} />
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
              <div className="grid gap-4 md:grid-cols-[1fr_200px] md:items-center">
                <ExpenseCategoryChart data={expensesByCategory} />
                <div className="space-y-2.5">
                  {expensesByCategory.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: item.color }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-semibold tabular-nums">{formatMoney(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts card (desktop) + trend chart */}
        <div className="flex flex-col gap-5">
          {alerts.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Alertas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {alerts.map((alert) => (
                  <div key={alert}
                    className="flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                    <p className="text-xs text-muted-foreground">{alert}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <TrendChart data={trendData} />

          {/* Savings & metas summary */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                <Wallet className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ahorro est.</p>
              <p className="mt-1 text-base font-bold text-emerald-400 tabular-nums">
                {formatMoney(metrics.estimatedSavings)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Deuda total</p>
              <p className="mt-1 text-base font-bold text-muted-foreground tabular-nums">
                {formatMoney(metrics.totalOutstandingDebt)}
              </p>
            </div>
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
          </div>
        </CardHeader>
        <CardContent>
          <RecentTransactions transactions={latestTransactions} />
        </CardContent>
      </Card>
    </div>
  );
}
