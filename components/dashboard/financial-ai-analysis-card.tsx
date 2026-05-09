"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Brain,
  CheckCircle2,
  Car,
  ChevronDown,
  CreditCard,
  Loader2,
  Repeat,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AiFinancialAnalysis = {
  summary: string;
  score: number;
  positivePoints: Array<{ title: string; message: string }>;
  alerts: Array<{ severity: "low" | "medium" | "high"; title: string; message: string }>;
  recommendations: Array<{ title: string; message: string; estimatedImpact: string }>;
  riskPoints: Array<{ title: string; message: string }>;
};

type AiFinancialAnalysisMetrics = {
  month: string;
  hasData: boolean;
  income: number;
  expenses: number;
  balance: number;
  savingsRate: number;
  fixedExpenseRate: number;
  dailyAverageExpense: number;
  projectedMonthEndExpense: number;
  expensesByCategory: Array<{
    name: string;
    total: number;
    count: number;
  }>;
  expensesByAccount: Array<{
    name: string;
    total: number;
    count: number;
  }>;
  categoryExpensePercentages: Array<{
    name: string;
    total: number;
    percentage: number;
  }>;
  mobilityTotal: number;
  mobilityRate: number;
  highImpactTransactions: Array<{
    date: string;
    amount: number;
    currency: string;
    incomePercentage: number;
    category: string;
    account: string;
    description: string;
  }>;
  repeatedSmallExpenses: Array<{
    description: string;
    normalizedDescription: string;
    count: number;
    total: number;
    averageAmount: number;
    categories: string[];
  }>;
  creditCardExpenseRate: number;
};

type AiFinancialAnalysisComparison = {
  available: boolean;
  currentMonth: string;
  previousMonth: string;
  incomeChangeAmount: number;
  incomeChangePercent: number | null;
  expenseChangeAmount: number;
  expenseChangePercent: number | null;
  balanceChangeAmount: number;
  balanceChangePercent: number | null;
  savingsRateChange: number;
  fixedExpenseRateChange: number;
  mobilityChangeAmount: number;
  mobilityChangePercent: number | null;
  creditCardRateChange: number;
  categoryChanges: Array<{
    category: string;
    currentAmount: number;
    previousAmount: number;
    changeAmount: number;
    changePercent: number | null;
  }>;
};

type ApiResponse = {
  data?: {
    analysis?: AiFinancialAnalysis;
    result?: AiFinancialAnalysis;
    metrics: AiFinancialAnalysisMetrics;
    previousMonthMetrics: AiFinancialAnalysisMetrics;
    comparison: AiFinancialAnalysisComparison;
    cached: boolean;
    stale?: boolean;
    month: string;
    generatedAt: string;
  } | null;
  error?: string;
};

const severityStyles = {
  low: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  medium: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  high: "border-rose-500/25 bg-rose-500/10 text-rose-300",
};

const severityLabels = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export function FinancialAiAnalysisCard({ month }: { month: string }) {
  const [analysis, setAnalysis] = useState<AiFinancialAnalysis | null>(null);
  const [metrics, setMetrics] = useState<AiFinancialAnalysisMetrics | null>(null);
  const [comparison, setComparison] = useState<AiFinancialAnalysisComparison | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isForbidden, setIsForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setMetrics(null);
    setComparison(null);
    setIsCached(false);
    setIsStale(false);
  }, []);

  const applyPayload = useCallback((payload: NonNullable<ApiResponse["data"]> & { analysis?: AiFinancialAnalysis }) => {
    const nextAnalysis = payload.analysis ?? payload.result;
    if (!nextAnalysis) {
      clearAnalysis();
      return;
    }

    setAnalysis(nextAnalysis);
    setMetrics(payload.metrics);
    setComparison(payload.comparison);
    setIsCached(payload.cached);
    setIsStale(Boolean(payload.stale));
  }, [clearAnalysis]);

  useEffect(() => {
    let ignore = false;

    async function loadSavedAnalysis() {
      setIsLoadingSaved(true);
      setError(null);
      setIsExpanded(false);

      try {
        const params = new URLSearchParams({ month });
        const response = await fetch(`/api/ai/monthly-analysis?${params.toString()}`);
        const payload = (await response.json()) as ApiResponse;

        if (ignore) return;

        if (response.status === 403) {
          setIsForbidden(true);
          setError(null);
          clearAnalysis();
          return;
        }

        if (!response.ok) {
          setError(payload.error ?? "No se pudo cargar el informe guardado.");
          clearAnalysis();
          return;
        }

        if (!payload.data) {
          clearAnalysis();
          return;
        }

        applyPayload(payload.data);
      } catch {
        if (!ignore) {
          setError("Error de red al cargar el informe guardado.");
          clearAnalysis();
        }
      } finally {
        if (!ignore) {
          setIsLoadingSaved(false);
        }
      }
    }

    void loadSavedAnalysis();

    return () => {
      ignore = true;
    };
  }, [applyPayload, clearAnalysis, month]);

  async function handleAnalyze() {
    if (isForbidden) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/monthly-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const payload = (await response.json()) as ApiResponse;

      const nextAnalysis = payload.data?.analysis ?? payload.data?.result;

      if (response.status === 403) {
        setIsForbidden(true);
        setError(null);
        clearAnalysis();
        return;
      }

      if (!response.ok || !payload.data || !nextAnalysis) {
        setError(payload.error ?? "No se pudo generar el análisis.");
        return;
      }

      applyPayload({ ...payload.data, analysis: nextAnalysis });
      setIsExpanded(true);
    } catch {
      setError("Error de red. Intentá nuevamente en unos segundos.");
    } finally {
      setIsLoading(false);
    }
  }

  const score = analysis?.score ?? 0;
  const scoreTone = score >= 75 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-rose-400";

  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="min-w-0 text-left"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
              <Brain className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <CardTitle className="text-base">Análisis inteligente del mes</CardTitle>
                {analysis && <Badge className={scoreTone}>Score {Math.round(score)}</Badge>}
                {isForbidden && <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-200">No habilitado</Badge>}
                {isStale && <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-200">Hay cambios</Badge>}
              </div>
              <CardDescription className="mt-0.5">
                {isForbidden
                  ? "Contactá al administrador para activar esta funcionalidad."
                  : isLoadingSaved
                    ? "Buscando informe guardado..."
                    : analysis
                      ? "Informe guardado. Tocá para desplegar."
                      : "Tocá para abrir la sección de IA."}
              </CardDescription>
            </div>
            <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
          </div>
        </button>
        <Button onClick={handleAnalyze} disabled={isLoading || isForbidden} className="w-full sm:w-auto">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          {analysis ? "Actualizar informe" : "Analizar con IA"}
        </Button>
      </CardHeader>
      {isExpanded && <CardContent className="space-y-4">
        {error && (
          <div className="flex gap-3 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
            <p className="text-sm leading-5 text-rose-100">{error}</p>
          </div>
        )}

        {isForbidden && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-100">Funcionalidad no habilitada</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Para activar el análisis inteligente con IA, contactate con el administrador.
            </p>
          </div>
        )}

        {!analysis && !error && !isForbidden && (
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Generá una lectura mensual con alertas, recomendaciones y riesgos detectados sin enviar tus transacciones completas a la IA.
            </p>
          </div>
        )}

        {analysis && (
          <>
            <div className="grid gap-3 md:grid-cols-[140px_1fr]">
              <div className="rounded-lg border border-border bg-background/35 p-4 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Score financiero</p>
                <p className={`mt-2 text-4xl font-extrabold tabular-nums ${scoreTone}`}>{Math.round(score)}</p>
                <p className="text-xs text-muted-foreground">/ 100</p>
              </div>
              <div className="rounded-lg border border-border bg-background/35 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className="border-violet-500/25 bg-violet-500/10 text-violet-200">IA</Badge>
                  {isCached && <Badge>Guardado</Badge>}
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
              </div>
            </div>

            {metrics && (
              <>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  <MetricPill label="Ahorro" value={`${formatPercent(metrics.savingsRate)}`} icon={TrendingUp} />
                  <MetricPill label="Fijos / ingresos" value={`${formatPercent(metrics.fixedExpenseRate)}`} icon={ShieldAlert} />
                  <MetricPill label="Proyección cierre" value={formatMoney(metrics.projectedMonthEndExpense)} icon={Target} />
                  <MetricPill label="Movilidad" value={formatMoney(metrics.mobilityTotal)} detail={`${formatPercent(metrics.mobilityRate)} de ingresos`} icon={Car} />
                  <MetricPill label="Tarjeta crédito" value={`${formatPercent(metrics.creditCardExpenseRate)}`} icon={CreditCard} />
                </div>

                <div className="rounded-lg border border-border bg-background/35 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-violet-300" aria-hidden="true" />
                    <h3 className="text-sm font-semibold">Gastos repetidos detectados</h3>
                  </div>
                  {metrics.repeatedSmallExpenses.length > 0 ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      {metrics.repeatedSmallExpenses.slice(0, 4).map((item) => (
                        <div key={item.normalizedDescription} className="rounded-md border border-border/70 bg-card/40 p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-semibold">{item.description}</p>
                            <Badge>{item.count}x</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Total {formatMoney(item.total)} · Promedio {formatMoney(item.averageAmount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm leading-5 text-muted-foreground">No se detectaron gastos chicos repetidos en este mes.</p>
                  )}
                </div>

                {comparison && <ComparisonSection comparison={comparison} />}
              </>
            )}

            <Section title="Alertas" icon={AlertTriangle}>
              {analysis.alerts.map((item) => (
                <div key={`${item.severity}-${item.title}`} className="rounded-lg border border-border p-3">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Badge className={severityStyles[item.severity]}>{severityLabels[item.severity]}</Badge>
                    <h4 className="text-sm font-semibold">{item.title}</h4>
                  </div>
                  <p className="text-sm leading-5 text-muted-foreground">{item.message}</p>
                </div>
              ))}
            </Section>

            <Section title="Recomendaciones" icon={Target}>
              {analysis.recommendations.map((item) => (
                <div key={item.title} className="rounded-lg border border-border p-3">
                  <h4 className="text-sm font-semibold">{item.title}</h4>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.message}</p>
                  <p className="mt-2 text-xs font-medium text-emerald-300">{item.estimatedImpact}</p>
                </div>
              ))}
            </Section>

            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Puntos positivos" icon={CheckCircle2}>
                {analysis.positivePoints.map((item) => (
                  <SmallItem key={item.title} title={item.title} message={item.message} icon={BadgeCheck} />
                ))}
              </Section>

              <Section title="Riesgos" icon={ShieldAlert}>
                {analysis.riskPoints.map((item) => (
                  <SmallItem key={item.title} title={item.title} message={item.message} icon={ShieldAlert} />
                ))}
              </Section>
            </div>
          </>
        )}
      </CardContent>}
    </Card>
  );
}

function ComparisonSection({ comparison }: { comparison: AiFinancialAnalysisComparison }) {
  const increases = comparison.categoryChanges
    .filter((category) => category.changeAmount > 0)
    .sort((a, b) => b.changeAmount - a.changeAmount)
    .slice(0, 3);
  const decreases = comparison.categoryChanges
    .filter((category) => category.changeAmount < 0)
    .sort((a, b) => a.changeAmount - b.changeAmount)
    .slice(0, 3);

  return (
    <section className="rounded-lg border border-border bg-background/35 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Comparación con el mes anterior</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {comparison.currentMonth} vs {comparison.previousMonth}
          </p>
        </div>
        <ChangeBadge value={comparison.available ? comparison.expenseChangeAmount : 0} />
      </div>

      {!comparison.available ? (
        <p className="text-sm leading-5 text-muted-foreground">
          No hay datos suficientes del mes anterior para comparar.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <ChangeMetric label="Gastos" amount={comparison.expenseChangeAmount} percent={comparison.expenseChangePercent} />
            <ChangeMetric label="Ingresos" amount={comparison.incomeChangeAmount} percent={comparison.incomeChangePercent} />
            <ChangeMetric label="Balance" amount={comparison.balanceChangeAmount} percent={comparison.balanceChangePercent} />
            <ChangeMetric label="Ahorro" amount={comparison.savingsRateChange} kind="percentagePoints" />
            <ChangeMetric label="Movilidad" amount={comparison.mobilityChangeAmount} percent={comparison.mobilityChangePercent} />
            <ChangeMetric label="Uso tarjeta" amount={comparison.creditCardRateChange} kind="percentagePoints" />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <CategoryChanges title="Categorías que más subieron" items={increases} emptyText="No hubo subas por categoría." />
            <CategoryChanges title="Categorías que más bajaron" items={decreases} emptyText="No hubo bajas por categoría." />
          </div>
        </div>
      )}
    </section>
  );
}

function ChangeMetric({
  label,
  amount,
  percent,
  kind = "money",
}: {
  label: string;
  amount: number;
  percent?: number | null;
  kind?: "money" | "percentagePoints";
}) {
  return (
    <div className="min-w-0 rounded-md border border-border/70 bg-card/40 p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <ChangeBadge value={amount} />
      </div>
      <p className="truncate text-sm font-bold tabular-nums">
        {kind === "money" ? formatSignedMoney(amount) : formatSignedPercentagePoints(amount)}
      </p>
      {kind === "money" && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{formatNullableChangePercent(percent)}</p>
      )}
    </div>
  );
}

function CategoryChanges({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: AiFinancialAnalysisComparison["categoryChanges"];
  emptyText: string;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card/40 p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      {items.length > 0 ? (
        <div className="mt-2 space-y-2">
          {items.map((item) => (
            <div key={item.category} className="min-w-0 rounded-md bg-background/40 p-2">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium">{item.category}</p>
                <ChangeBadge value={item.changeAmount} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatSignedMoney(item.changeAmount)} · {formatNullableChangePercent(item.changePercent)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm leading-5 text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

function ChangeBadge({ value }: { value: number }) {
  const label = value > 0 ? "Subió" : value < 0 ? "Bajó" : "Sin cambios";
  const className = value > 0
    ? "border-rose-500/25 bg-rose-500/10 text-rose-200"
    : value < 0
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
      : "border-border bg-secondary/50 text-muted-foreground";

  return <Badge className={className}>{label}</Badge>;
}

function MetricPill({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: typeof TrendingUp;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background/35 p-3">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 text-violet-300" aria-hidden="true" />
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className="truncate text-sm font-bold tabular-nums">{value}</p>
      {detail && <p className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof AlertTriangle;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-violet-300" aria-hidden="true" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

function SmallItem({
  title,
  message,
  icon: Icon,
}: {
  title: string;
  message: string;
  icon: typeof BadgeCheck;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-border p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
      <div className="min-w-0">
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{message}</p>
      </div>
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

function formatSignedMoney(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatMoney(value)}`;
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)}%`;
}

function formatSignedPercentagePoints(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatPercent(value)} p.p.`;
}

function formatNullableChangePercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Sin base anterior";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatPercent(value)}`;
}
