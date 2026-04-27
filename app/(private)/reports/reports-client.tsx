"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  PiggyBank,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

type ReportsClientProps = {
  householdId: string;
};

const MONTHS_OPTIONS = [3, 6, 12] as const;
type MonthsOption = (typeof MONTHS_OPTIONS)[number];

export function ReportsClient({ householdId }: ReportsClientProps) {
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [months, setMonths] = useState<MonthsOption>(6);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadReport(months);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);

  async function loadReport(selectedMonths: MonthsOption) {
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
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex h-72 flex-col items-center justify-center p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">No se pudo cargar el reporte</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const hasTrend = report && report.trend.length > 0;
  const hasCategories = report && report.topCategories.length > 0;

  const lastMonth = report?.trend[report.trend.length - 1];
  const avgSavingsRate =
    report && report.trend.length > 0
      ? Math.round(report.trend.reduce((s, p) => s + p.savingsRate, 0) / report.trend.length)
      : 0;

  return (
    <div className="space-y-6">
      <div
        className="flex w-fit rounded-[10px] border border-border p-1"
        style={{ background: "var(--surface)" }}
      >
        {([
          [3, "Mensual"],
          [6, "Trimestral"],
          [12, "Anual"],
        ] as const).map(([option, label]) => (
          <button
            key={option}
            type="button"
            disabled={isLoading}
            onClick={() => setMonths(option)}
            className="rounded-[7px] px-4 py-2 text-xs font-semibold transition-all duration-150 disabled:opacity-50"
            style={
              months === option
                ? { background: "hsl(var(--primary))", color: "#fff", boxShadow: "0 2px 8px rgba(124,58,237,.35)" }
                : { background: "transparent", color: "hsl(var(--muted-foreground))" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Generando reporte
          </CardContent>
        </Card>
      ) : !hasTrend ? (
        <EmptyState
          icon={TrendingUp}
          title="Sin datos suficientes"
          description="Registrá transacciones para ver la evolución mensual de tus finanzas."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              label="Promedio de ahorro"
              value={formatMoney(report.trend.reduce((s, p) => s + p.savings, 0) / report.trend.length)}
              color="#34d399"
              Icon={PiggyBank}
            />
            <KpiCard
              label="Mejor mes"
              value={report.trend.reduce((a, b) => (a.savings > b.savings ? a : b)).label}
              color="#a78bfa"
              Icon={Star}
            />
            <KpiCard
              label="Tasa promedio"
              value={`${avgSavingsRate}%`}
              color="#60a5fa"
              Icon={TrendingUp}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ingresos vs Gastos</CardTitle>
              <CardDescription>Comparación mensual para identificar tendencias.</CardDescription>
            </CardHeader>
            <CardContent>
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
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="income" name="income" fill="#34d399" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="expenses" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evolución del ahorro</CardTitle>
              <CardDescription>Porcentaje de ahorro mensual (ingresos − gastos) / ingresos.</CardDescription>
            </CardHeader>
            <CardContent>
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
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.75rem",
                        fontSize: 12,
                      }}
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
            </CardContent>
          </Card>

          {hasCategories ? (
            <Card>
              <CardHeader>
                <CardTitle>Top categorías de gasto</CardTitle>
                <CardDescription>Distribución del último mes registrado.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3.5">
                  {report.topCategories.map((cat) => (
                    <div key={cat.categoryId} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-sm"
                            style={{ backgroundColor: cat.color ?? "#6366f1" }}
                          />
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
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex h-32 items-center justify-center">
                <p className="text-sm text-muted-foreground">Sin gastos por categoría en el último mes.</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Evolución del ahorro neto</CardTitle>
              <CardDescription>Saldo disponible por mes.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {(() => {
                  const max = Math.max(...report.trend.map((d) => d.savings));
                  return report.trend.map((d, i) => {
                    const h = Math.max(12, (d.savings / (max || 1)) * 100);
                    const isLast = i === report.trend.length - 1;
                    return (
                      <div key={d.label} className="flex min-w-[44px] flex-1 flex-col items-center gap-1.5">
                        <span className="whitespace-nowrap text-[11px] font-bold tabular-nums text-emerald-400">
                          ${(d.savings / 1000).toFixed(0)}k
                        </span>
                        <div className="flex h-24 w-full items-end justify-center">
                          <div
                            className="w-[70%] min-h-[6px] rounded-t-[4px]"
                            style={{
                              height: `${h}%`,
                              background: "linear-gradient(180deg,#34d399,#34d39944)",
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
            </CardContent>
          </Card>

          <div className="flex flex-col items-center gap-2 py-4 text-center text-muted-foreground">
            <TrendingDown className="h-7 w-7" aria-hidden="true" />
            <p className="text-[13px]">
              Más reportes próximamente — flujo de caja, comparación por período y exportación PDF.
            </p>
          </div>
        </>
      )}
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
    <div className="rounded-xl border border-border bg-card p-[18px]">
      <div className="mb-2.5 flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
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
