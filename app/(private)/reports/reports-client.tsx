"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  PiggyBank,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/app/empty-state";
import {
  PremiumCard,
  PremiumCardContent,
  PremiumCardDescription,
  PremiumCardHeader,
  PremiumCardTitle,
} from "@/components/ui-v2/premium-card";

type TrendPoint = {
  label: string;
  year: number;
  month: number;
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
};

type TopCategory = {
  categoryId: string;
  name: string;
  color: string | null;
  total: number;
  percentage: number;
};

type MonthlyReport = {
  trend: TrendPoint[];
  topCategories: TopCategory[];
};

type MonthlySnapshotItem = {
  id: string;
  year: number;
  month: number;
  currency: string;
  incomeAmount: number;
  expenseAmount: number;
  reservedAmount: number;
  goalAllocatedAmount: number;
  debtOutstandingAmount: number;
  upcomingObligationsAmount: number;
  availableAmount: number;
};

type ReportsClientProps = {
  householdId: string;
};

const PERIODS = [
  { value: 1, label: "Mensual" },
  { value: 3, label: "3 meses" },
  { value: 6, label: "6 meses" },
  { value: 12, label: "Último año" },
] as const;

type MonthsOption = (typeof PERIODS)[number]["value"];

export function ReportsClient({ householdId }: ReportsClientProps) {
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [months, setMonths] = useState<MonthsOption>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<MonthlySnapshotItem[]>([]);
  const snapshotsFetched = useRef(false);

  const loadReport = useCallback(async (selectedMonths: MonthsOption) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        householdId,
        months: String(selectedMonths),
      });
      const response = await fetch(`/api/reports/monthly?${params.toString()}`);
      const payload = (await response.json()) as { data?: MonthlyReport; error?: string };

      if (!response.ok) {
        setError(payload.error ?? "No se pudo cargar el reporte.");
        return;
      }

      setReport(payload.data ?? null);
    } catch {
      setError("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadReport(months);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadReport, months]);

  useEffect(() => {
    if (snapshotsFetched.current) return;
    snapshotsFetched.current = true;
    void (async () => {
      try {
        const params = new URLSearchParams({ householdId, limit: "24" });
        const res = await fetch(`/api/snapshots?${params}`);
        const payload = (await res.json()) as { data?: MonthlySnapshotItem[] };
        if (res.ok && payload.data) setSnapshots(payload.data);
      } catch {
        // silencioso — el historial es complementario
      }
    })();
  }, [householdId]);

  if (error) {
    return (
      <PremiumCard variant="raised">
        <PremiumCardContent className="flex h-72 flex-col items-center justify-center p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">No se pudo cargar la memoria</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </PremiumCardContent>
      </PremiumCard>
    );
  }

  const hasTrend = report && report.trend.length > 0;
  const hasCategories = report && report.topCategories.length > 0;

  const totalIncome = report?.trend.reduce((s, p) => s + p.income, 0) ?? 0;
  const totalExpenses = report?.trend.reduce((s, p) => s + p.expenses, 0) ?? 0;
  const totalSavings = report?.trend.reduce((s, p) => s + p.savings, 0) ?? 0;
  const avgSavingsRate =
    report && report.trend.length > 0
      ? Math.round(report.trend.reduce((s, p) => s + p.savingsRate, 0) / report.trend.length)
      : 0;
  const bestMonth = report?.trend.length
    ? report.trend.reduce((a, b) => (a.savings > b.savings ? a : b))
    : null;
  const worstMonth = report?.trend.length
    ? report.trend.reduce((a, b) => (a.expenses > b.expenses ? a : b))
    : null;

  return (
    <div className="space-y-6">
      <PremiumCard variant="raised" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_18%_0%,rgba(96,165,250,0.16),transparent_36%),radial-gradient(circle_at_82%_0%,rgba(52,211,153,0.13),transparent_34%)]" />
        <PremiumCardContent className="relative p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                Lectura del período
              </div>
              <h2 className="text-balance text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
                {hasTrend ? getMemoryTitle(totalSavings, avgSavingsRate) : "Tu memoria financiera se está formando."}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                {hasTrend
                  ? "Miramos ingresos, gastos, ahorro y categorías para encontrar el pulso real del período."
                  : "Registrá movimientos y snapshots para que la app pueda narrar tendencias con más precisión."}
              </p>
            </div>

            <div className="flex w-full overflow-x-auto rounded-2xl border border-border bg-muted/40 p-1 sm:w-fit">
              {PERIODS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  disabled={isLoading}
                  onClick={() => setMonths(value)}
                  className={`shrink-0 rounded-[14px] px-4 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                    months === value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {hasTrend ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MemoryMetric icon={TrendingUp} label="Ingresos" value={formatMoney(totalIncome)} />
              <MemoryMetric icon={TrendingDown} label="Gastos" value={formatMoney(totalExpenses)} />
              <MemoryMetric icon={PiggyBank} label="Ahorro" value={formatMoney(totalSavings)} />
            </div>
          ) : null}
        </PremiumCardContent>
      </PremiumCard>

      {isLoading ? (
        <PremiumCard>
          <PremiumCardContent className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Generando memoria
          </PremiumCardContent>
        </PremiumCard>
      ) : !hasTrend ? (
        <PremiumCard>
          <PremiumCardContent>
            <EmptyState
              icon={TrendingUp}
              title="La memoria mensual está esperando datos."
              description="Cuando tengas movimientos en al menos dos meses, Meridian va a mostrar evolución, ahorro y cambios relevantes sin que parezca una pantalla rota."
              actions={[
                { label: "Registrar movimiento", href: "/transactions?new=1", primary: true },
                { label: "Usar Smart Import", href: "/smart-import" },
              ]}
            />
          </PremiumCardContent>
        </PremiumCard>
      ) : (
        <>
          {/* Period summary */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Ingresos totales" value={formatMoney(totalIncome)} color="#34d399" Icon={TrendingUp} />
            <KpiCard label="Gastos totales" value={formatMoney(totalExpenses)} color="#f87171" Icon={TrendingDown} />
            <KpiCard label="Ahorro neto" value={formatMoney(totalSavings)} color="#60a5fa" Icon={Wallet} />
            <KpiCard label="Tasa promedio" value={`${avgSavingsRate}%`} color="#a78bfa" Icon={PiggyBank} />
          </div>

          {/* Insights row */}
          {(bestMonth ?? worstMonth) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {bestMonth && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-4">
                  <Star className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Mejor mes</p>
                    <p className="text-sm font-semibold">{bestMonth.label} · {formatMoney(bestMonth.savings)} ahorrado</p>
                  </div>
                </div>
              )}
              {worstMonth && (
                <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/8 p-4">
                  <TrendingDown className="h-5 w-5 shrink-0 text-rose-400" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">Mayor gasto</p>
                    <p className="text-sm font-semibold">{worstMonth.label} · {formatMoney(worstMonth.expenses)} gastado</p>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Income vs Expenses chart */}
          <PremiumCard>
            <PremiumCardHeader>
              <PremiumCardTitle>Ingresos vs Gastos</PremiumCardTitle>
              <PremiumCardDescription>Comparación mensual para identificar tendencias.</PremiumCardDescription>
            </PremiumCardHeader>
            <PremiumCardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.trend} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatMoneyShort}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      width={70}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        formatMoney(Number(value ?? 0)),
                        name === "income" ? "Ingresos" : "Gastos",
                      ]}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: 12, color: "hsl(var(--foreground))", padding: "8px 12px" }}
                    />
                    <Bar dataKey="income" name="income" fill="#34d399" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="expenses" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </PremiumCardContent>
          </PremiumCard>

          {/* Savings rate chart */}
          <PremiumCard>
            <PremiumCardHeader>
              <PremiumCardTitle>Tasa de ahorro</PremiumCardTitle>
              <PremiumCardDescription>Porcentaje mensual: ingresos menos gastos sobre ingresos.</PremiumCardDescription>
            </PremiumCardHeader>
            <PremiumCardContent>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v: number) => `${v}%`}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      formatter={(value) => [`${String(value ?? 0)}%`, "Tasa de ahorro"]}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: 12, color: "hsl(var(--foreground))", padding: "8px 12px" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="savingsRate"
                      stroke="#818cf8"
                      strokeWidth={2.5}
                      dot={{ fill: "#818cf8", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </PremiumCardContent>
          </PremiumCard>

          {/* Categories */}
          {hasCategories ? (
            <div className="grid gap-6 xl:grid-cols-2">
              {/* Pie chart */}
              <PremiumCard>
                <PremiumCardHeader>
                  <PremiumCardTitle>Distribución por categoría</PremiumCardTitle>
                  <PremiumCardDescription>Participación de cada categoría en el gasto del período.</PremiumCardDescription>
                </PremiumCardHeader>
                <PremiumCardContent>
                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                    <div className="h-[200px] w-full max-w-[200px] shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={report.topCategories}
                            dataKey="total"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={80}
                            paddingAngle={2}
                          >
                            {report.topCategories.map((cat) => (
                              <Cell key={cat.categoryId} fill={cat.color ?? "#6366f1"} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => [formatMoney(Number(value)), ""]}
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: 12, color: "hsl(var(--foreground))", padding: "8px 12px" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full space-y-2 min-w-0">
                      {report.topCategories.map((cat) => (
                        <div key={cat.categoryId} className="flex items-center justify-between gap-2 text-sm">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cat.color ?? "#6366f1" }} />
                            <span className="truncate text-xs font-medium">{cat.name}</span>
                          </div>
                          <span className="shrink-0 text-xs font-semibold tabular-nums" style={{ color: cat.color ?? "#6366f1" }}>
                            {cat.percentage}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </PremiumCardContent>
              </PremiumCard>

              {/* Bars */}
              <PremiumCard>
                <PremiumCardHeader>
                  <PremiumCardTitle>Top categorías de gasto</PremiumCardTitle>
                  <PremiumCardDescription>Monto acumulado en el período seleccionado.</PremiumCardDescription>
                </PremiumCardHeader>
                <PremiumCardContent>
                  <div className="space-y-3.5">
                    {report.topCategories.map((cat) => (
                      <div key={cat.categoryId} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: cat.color ?? "#6366f1" }} />
                            <span className="truncate font-medium">{cat.name}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-3 text-right">
                            <span className="text-muted-foreground">{cat.percentage}%</span>
                            <span className="font-semibold tabular-nums" style={{ color: cat.color ?? "#6366f1" }}>
                              {formatMoney(cat.total)}
                            </span>
                          </div>
                        </div>
                        <div className="h-[5px] w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full transition-[width] duration-700 ease-out"
                            style={{ width: `${cat.percentage}%`, backgroundColor: cat.color ?? "#6366f1" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </PremiumCardContent>
              </PremiumCard>
            </div>
          ) : (
            <PremiumCard>
              <PremiumCardContent className="flex h-32 items-center justify-center">
                <p className="text-sm text-muted-foreground">Sin gastos por categoría en el período.</p>
              </PremiumCardContent>
            </PremiumCard>
          )}

          {/* Savings bars */}
          <PremiumCard>
            <PremiumCardHeader>
              <PremiumCardTitle>Ahorro neto por mes</PremiumCardTitle>
              <PremiumCardDescription>Saldo disponible (ingresos − gastos) para cada mes del período.</PremiumCardDescription>
            </PremiumCardHeader>
            <PremiumCardContent>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {(() => {
                  const max = Math.max(...report.trend.map((d) => d.savings));
                  return report.trend.map((d, i) => {
                    const h = Math.max(12, (d.savings / (max || 1)) * 100);
                    const isLast = i === report.trend.length - 1;
                    const isNegative = d.savings < 0;
                    return (
                      <div key={d.label} className="flex min-w-[44px] flex-1 flex-col items-center gap-1.5">
                        <span className={`whitespace-nowrap text-[11px] font-bold tabular-nums ${isNegative ? "text-rose-400" : "text-emerald-400"}`}>
                          {isNegative ? "-" : ""}${(Math.abs(d.savings) / 1000).toFixed(0)}k
                        </span>
                        <div className="flex h-24 w-full items-end justify-center">
                          <div
                            className="w-[70%] min-h-[6px] rounded-t-[4px]"
                            style={{
                              height: `${h}%`,
                              background: isNegative
                                ? "linear-gradient(180deg,#f87171,#f8717144)"
                                : "linear-gradient(180deg,#34d399,#34d39944)",
                              boxShadow: isLast ? "0 0 12px rgba(52,211,153,.3)" : "none",
                              transition: "height 0.85s ease",
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground">{d.label}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </PremiumCardContent>
          </PremiumCard>
        </>
      )}

      {snapshots.length > 0 && <SnapshotHistorySection snapshots={snapshots} />}
    </div>
  );
}

const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function MemoryMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-border bg-muted/30 p-4">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 text-[11px] font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function getMemoryTitle(totalSavings: number, avgSavingsRate: number) {
  if (totalSavings < 0) return "El período dejó una señal de presión.";
  if (avgSavingsRate >= 25) return "Tu dinero tuvo un período fuerte.";
  if (avgSavingsRate >= 10) return "El período cerró con margen saludable.";
  return "El período necesita una lectura más fina.";
}

function SnapshotHistorySection({ snapshots }: { snapshots: MonthlySnapshotItem[] }) {
  const chartData = snapshots.map((s) => ({
    label: `${MONTH_SHORT[s.month - 1]} ${String(s.year).slice(2)}`,
    disponible: s.availableAmount,
    ingresos: s.incomeAmount,
    gastos: s.expenseAmount,
    deuda: s.debtOutstandingAmount,
  }));

  return (
    <div className="space-y-6 border-t border-border pt-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Historial de patrimonio</h2>
        <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
          Snapshot mensual capturado al cierre de cada período. Refleja el dinero disponible real y la deuda total en ese momento.
        </p>
      </div>

      <PremiumCard>
        <PremiumCardHeader>
          <PremiumCardTitle>Disponible real por mes</PremiumCardTitle>
          <PremiumCardDescription>Evolución del dinero disponible real (ingresos − gastos − reservas − obligaciones) al cierre de cada mes.</PremiumCardDescription>
        </PremiumCardHeader>
        <PremiumCardContent>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradDisp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatMoneyShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={70} />
                <Tooltip
                  formatter={(value) => [formatMoney(Number(value)), "Disponible"]}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: 12, color: "hsl(var(--foreground))", padding: "8px 12px" }}
                />
                <Area type="monotone" dataKey="disponible" stroke="#818cf8" strokeWidth={2.5} fill="url(#gradDisp)" dot={{ fill: "#818cf8", r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </PremiumCardContent>
      </PremiumCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <PremiumCard>
          <PremiumCardHeader>
            <PremiumCardTitle>Ingresos vs Gastos histórico</PremiumCardTitle>
            <PremiumCardDescription>Comparación mensual acumulada desde el primer snapshot.</PremiumCardDescription>
          </PremiumCardHeader>
          <PremiumCardContent>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatMoneyShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip
                    formatter={(value, name) => [formatMoney(Number(value)), name === "ingresos" ? "Ingresos" : "Gastos"]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: 12, color: "hsl(var(--foreground))", padding: "8px 12px" }}
                  />
                  <Bar dataKey="ingresos" fill="#34d399" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gastos" fill="#f87171" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </PremiumCardContent>
        </PremiumCard>

        <PremiumCard>
          <PremiumCardHeader>
            <PremiumCardTitle>Deuda total al cierre</PremiumCardTitle>
            <PremiumCardDescription>Saldo pendiente de deudas activas registrado en cada snapshot.</PremiumCardDescription>
          </PremiumCardHeader>
          <PremiumCardContent>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gradDeuda" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatMoneyShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip
                    formatter={(value) => [formatMoney(Number(value)), "Deuda total"]}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: 12, color: "hsl(var(--foreground))", padding: "8px 12px" }}
                  />
                  <Area type="monotone" dataKey="deuda" stroke="#f87171" strokeWidth={2.5} fill="url(#gradDeuda)" dot={{ fill: "#f87171", r: 3 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </PremiumCardContent>
        </PremiumCard>
      </div>

      <PremiumCard>
        <PremiumCardHeader>
          <PremiumCardTitle>Detalle por mes</PremiumCardTitle>
          <PremiumCardDescription>Tabla completa de métricas capturadas en cada snapshot.</PremiumCardDescription>
        </PremiumCardHeader>
        <PremiumCardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Mes</th>
                  <th className="pb-2 pr-4 text-right font-medium text-emerald-400">Ingresos</th>
                  <th className="pb-2 pr-4 text-right font-medium text-rose-400">Gastos</th>
                  <th className="pb-2 pr-4 text-right font-medium text-amber-400">Reservado</th>
                  <th className="pb-2 pr-4 text-right font-medium text-rose-400">Deuda</th>
                  <th className="pb-2 text-right font-medium text-primary">Disponible real</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...snapshots].reverse().map((s) => (
                  <tr key={s.id} className="text-foreground">
                    <td className="py-2 pr-4 font-medium">{MONTH_SHORT[s.month - 1]} {s.year}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-emerald-400">{formatMoney(s.incomeAmount)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-rose-400">{formatMoney(s.expenseAmount)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-amber-400">{formatMoney(s.reservedAmount)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-rose-400">{formatMoney(s.debtOutstandingAmount)}</td>
                    <td className={`py-2 text-right tabular-nums font-semibold ${s.availableAmount >= 0 ? "text-primary" : "text-rose-400"}`}>
                      {formatMoney(s.availableAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PremiumCardContent>
      </PremiumCard>
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
  Icon,
}: {
  label: string;
  value: string;
  color: string;
  Icon: React.ElementType;
}) {
  return (
    <div className="v2-card rounded-2xl p-[18px]">
      <div className="mb-2.5 flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-2xl"
          style={{ background: `${color}18`, color }}
        >
          <Icon className="h-[15px] w-[15px]" aria-hidden="true" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">{label}</p>
      </div>
      <p className="text-xl font-extrabold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMoneyShort(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}k`;
  }
  return `$${value}`;
}
