"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Brain,
  CalendarDays,
  Car,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Eye,
  Loader2,
  Repeat,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SensitiveAmount, SensitiveText } from "@/components/app/sensitive-amount";
import { captureClientError, trackProductEvent } from "@/lib/observability/client";

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
  currency: string;
  currencyScope: {
    primaryCurrency: string;
    totalsByCurrency: Array<{ currency: string; amount: number; count: number }>;
    ignoredCurrencies: string[];
    mixedCurrencies: boolean;
  };
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

type InsightTone = "emerald" | "amber" | "rose" | "sky" | "violet" | "zinc";
type InsightPriority = "Alta" | "Media" | "Suave";
type IconType = typeof Sparkles;

type NarrativeInsight = {
  id: string;
  title: string;
  message: string;
  detail: string;
  tone: InsightTone;
  priority: InsightPriority;
  icon: IconType;
};

const easeOut = [0.22, 1, 0.36, 1] as const;

const containerMotion: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemMotion: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: easeOut },
  },
};

const toneStyles: Record<InsightTone, {
  card: string;
  glow: string;
  icon: string;
  badge: string;
  text: string;
}> = {
  emerald: {
    card: "border-emerald-400/20 bg-emerald-400/[0.07]",
    glow: "shadow-[0_18px_60px_rgba(52,211,153,0.08)]",
    icon: "bg-emerald-400/12 text-emerald-400",
    badge: "border-emerald-300/20 bg-emerald-300/10 text-emerald-400",
    text: "text-emerald-400",
  },
  amber: {
    card: "border-amber-300/20 bg-amber-300/[0.08]",
    glow: "shadow-[0_18px_60px_rgba(251,191,36,0.08)]",
    icon: "bg-amber-300/12 text-amber-500",
    badge: "border-amber-300/20 bg-amber-300/10 text-amber-500",
    text: "text-amber-500",
  },
  rose: {
    card: "border-rose-300/20 bg-rose-400/[0.08]",
    glow: "shadow-[0_18px_60px_rgba(251,113,133,0.08)]",
    icon: "bg-rose-300/12 text-destructive",
    badge: "border-rose-300/20 bg-rose-300/10 text-destructive",
    text: "text-destructive",
  },
  sky: {
    card: "border-sky-300/20 bg-sky-400/[0.08]",
    glow: "shadow-[0_18px_60px_rgba(56,189,248,0.08)]",
    icon: "bg-sky-300/12 text-sky-400",
    badge: "border-sky-300/20 bg-sky-300/10 text-sky-400",
    text: "text-sky-400",
  },
  violet: {
    card: "border-teal-300/20 bg-teal-300/[0.08]",
    glow: "shadow-[0_18px_60px_rgba(45,212,191,0.08)]",
    icon: "bg-teal-300/12 text-primary",
    badge: "border-teal-300/20 bg-teal-300/10 text-primary",
    text: "text-primary",
  },
  zinc: {
    card: "border-border bg-muted/40",
    glow: "shadow-[0_18px_60px_rgba(255,255,255,0.03)]",
    icon: "bg-muted text-foreground",
    badge: "border-border bg-muted text-muted-foreground",
    text: "text-foreground",
  },
};

export function FinancialAiAnalysisCard({ month }: { month: string }) {
  const [analysis, setAnalysis] = useState<AiFinancialAnalysis | null>(null);
  const [metrics, setMetrics] = useState<AiFinancialAnalysisMetrics | null>(null);
  const [comparison, setComparison] = useState<AiFinancialAnalysisComparison | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isForbidden, setIsForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      trackProductEvent("monthly_analysis_opened", { cached: isCached }, "ai");
    }
  }, [isOpen, isCached]);

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setMetrics(null);
    setComparison(null);
    setIsCached(false);
    setIsStale(false);
    setIsOpen(false);
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
      setIsOpen(false);

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
    trackProductEvent("ai_analysis_started", { route: "/dashboard" }, "ai");

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
        trackProductEvent("ai_analysis_failed", { reason: "api_error" }, "ai");
        return;
      }

      applyPayload({ ...payload.data, analysis: nextAnalysis });
      trackProductEvent(
        "ai_analysis_succeeded",
        { cached: Boolean(payload.data.cached), stale: Boolean(payload.data.stale) },
        "ai",
      );
      setIsOpen(true);
    } catch (err) {
      captureClientError(err, "ai", { reason: "monthly_analysis_network" });
      trackProductEvent("ai_analysis_failed", { reason: "network" }, "ai");
      setError("Error de red. Intentá nuevamente en unos segundos.");
    } finally {
      setIsLoading(false);
    }
  }

  const scoreLabel = analysis ? getScoreLabel(clamp(Math.round(analysis.score), 0, 100)) : null;

  return (
    <section data-tutorial="financial-copilot" className="mb-6 rounded-[20px] border border-border bg-[linear-gradient(160deg,rgba(45,212,191,0.04),transparent_50%)] bg-card shadow-[0_4px_24px_rgba(0,0,0,0.10)] sm:mb-8">
      <div className="px-4 py-3 sm:px-5 sm:py-4">
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => analysis && metrics ? setIsOpen((current) => !current) : undefined}
            aria-expanded={analysis && metrics ? isOpen : undefined}
            aria-controls="financial-copilot-content"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Brain className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Lectura del mes</p>
                {isStale && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-label="Datos nuevos disponibles" />}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {scoreLabel ? `Tu panorama mensual · Estabilidad ${scoreLabel}` : "Tu panorama financiero mensual."}
              </p>
            </div>
            {analysis && metrics && (
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition duration-300 ${isOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            )}
          </button>
          {analysis && (
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isLoading || isForbidden}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              {isLoading
                ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                : <Sparkles className="h-3 w-3" aria-hidden="true" />
              }
              Actualizar
            </button>
          )}
        </div>

        <div id="financial-copilot-content">
          <AnimatePresence mode="wait" initial={false}>
            {isLoadingSaved ? (
              <PremiumLoading key="loading" />
            ) : analysis && metrics && !isOpen ? (
              <CollapsedCopilotPreview
                key="preview"
                analysis={analysis}
                metrics={metrics}
                comparison={comparison}
                onOpen={() => setIsOpen(true)}
              />
            ) : analysis && metrics ? (
              <CopilotExperience
                key="experience"
                analysis={analysis}
                metrics={metrics}
                comparison={comparison}
              />
            ) : (
              <CopilotEmptyState
                key="empty"
                error={error}
                isForbidden={isForbidden}
                onAnalyze={handleAnalyze}
                isLoading={isLoading}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function CollapsedCopilotPreview({
  analysis,
  metrics,
  comparison,
  onOpen,
}: {
  analysis: AiFinancialAnalysis;
  metrics: AiFinancialAnalysisMetrics;
  comparison: AiFinancialAnalysisComparison | null;
  onOpen: () => void;
}) {
  const hero = useMemo(() => buildHeroNarrative(analysis, metrics, comparison), [analysis, metrics, comparison]);
  const insights = useMemo(() => buildImportantInsights(analysis, metrics, comparison), [analysis, metrics, comparison]);
  const primaryInsight = insights[0];
  const score = clamp(Math.round(analysis.score), 0, 100);
  const scoreStyle = toneStyles[getScoreTone(score)];
  const scoreLabel = getScoreLabel(score);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: easeOut }}
      onClick={onOpen}
      className="w-full rounded-[18px] border border-border/60 bg-muted/20 p-4 text-left transition hover:bg-muted/30"
    >
      <div className="grid grid-cols-[1fr_auto] items-start gap-4">
        <div className="min-w-0">
          <h2 className="text-balance text-xl font-semibold leading-tight text-foreground sm:text-2xl">{hero.title}</h2>
          <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-muted-foreground">{hero.subtitle}</p>
          {primaryInsight && (
            <div className="mt-3 flex min-w-0 items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-2">
              <primaryInsight.icon className={`h-3.5 w-3.5 shrink-0 ${toneStyles[primaryInsight.tone].text}`} aria-hidden="true" />
              <p className="min-w-0 truncate text-xs text-muted-foreground">
                <SensitiveText text={primaryInsight.title} />
              </p>
              <ChevronDown className="ml-auto h-3 w-3 shrink-0 -rotate-90 text-muted-foreground/40" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-semibold tabular-nums ${scoreStyle.text}`}>{scoreLabel}</p>
          <p className="text-[11px] tabular-nums text-muted-foreground">{score}/100</p>
        </div>
      </div>
    </motion.button>
  );
}

function CopilotExperience({
  analysis,
  metrics,
  comparison,
}: {
  analysis: AiFinancialAnalysis;
  metrics: AiFinancialAnalysisMetrics;
  comparison: AiFinancialAnalysisComparison | null;
}) {
  const insights = useMemo(() => buildImportantInsights(analysis, metrics, comparison), [analysis, metrics, comparison]);
  const hero = useMemo(() => buildHeroNarrative(analysis, metrics, comparison), [analysis, metrics, comparison]);
  const invisibleExpenses = metrics.repeatedSmallExpenses.slice(0, 5);

  return (
    <motion.div
      variants={containerMotion}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, y: 10 }}
      className="space-y-3"
    >
      <FinancialCopilotHero hero={hero} metrics={metrics} comparison={comparison} />
      <ImportantInsights insights={insights} />
      <InvisibleExpenses items={invisibleExpenses} income={metrics.income} currency={metrics.currency} />
      <MonthPrediction metrics={metrics} />
      {comparison && <MonthComparison comparison={comparison} currency={metrics.currency} />}
      <ActionPlan recommendations={analysis.recommendations} metrics={metrics} />
    </motion.div>
  );
}

function FinancialCopilotHero({
  hero,
  metrics,
  comparison,
}: {
  hero: { title: string; subtitle: string; tone: InsightTone; trend: string };
  metrics: AiFinancialAnalysisMetrics;
  comparison: AiFinancialAnalysisComparison | null;
}) {
  const trendIsPositive = comparison?.available ? comparison.balanceChangeAmount >= 0 : metrics.balance >= 0;

  return (
    <motion.div variants={itemMotion} className="overflow-hidden rounded-[18px] border border-border bg-[radial-gradient(circle_at_15%_0%,rgba(45,212,191,0.10),transparent_50%)] bg-card/50 p-4">
      {metrics.currencyScope.mixedCurrencies && (
        <div className="mb-2">
          <Badge className="border-border bg-muted text-[11px] text-muted-foreground">
            {metrics.currencyScope.ignoredCurrencies.join(", ")} separado
          </Badge>
        </div>
      )}
      <h2 className="max-w-2xl text-balance text-xl font-semibold leading-tight text-foreground sm:text-2xl">
        {hero.title}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-snug text-muted-foreground">
        <SensitiveText text={hero.subtitle} />
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <SignalPill icon={trendIsPositive ? ArrowUpRight : ArrowDownRight} label={hero.trend} tone={trendIsPositive ? "emerald" : "amber"} />
        <SignalPill icon={Wallet} label={`${formatPercent(metrics.savingsRate)} ahorro`} tone={metrics.savingsRate >= 0 ? "sky" : "rose"} />
      </div>
    </motion.div>
  );
}

function ImportantInsights({ insights }: { insights: NarrativeInsight[] }) {
  return (
    <motion.section variants={itemMotion} className="space-y-2">
      <SectionHeader eyebrow="Hoy importa" title="Insights importantes" icon={Sparkles} />
      <div className="grid gap-2 lg:grid-cols-3">
        {insights.map((insight, index) => (
          <InsightCard key={insight.id} insight={insight} featured={index === 0} />
        ))}
      </div>
    </motion.section>
  );
}

function InsightCard({ insight, featured }: { insight: NarrativeInsight; featured?: boolean }) {
  const styles = toneStyles[insight.tone];
  const Icon = insight.icon;

  return (
    <motion.article
      whileHover={{ y: -2, scale: 1.005 }}
      transition={{ duration: 0.2 }}
      className={`min-w-0 rounded-[18px] border p-3 ${styles.card} ${styles.glow} ${featured ? "lg:col-span-2" : ""}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <Badge className={`${styles.badge} shrink-0 text-[10px]`}>{insight.priority}</Badge>
      </div>
      <h3 className={`text-balance text-sm font-semibold leading-tight ${styles.text}`}>
        <SensitiveText text={insight.title} />
      </h3>
      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
        <SensitiveText text={insight.message} />
      </p>
      {featured && (
        <p className="mt-2 text-xs leading-snug text-muted-foreground/70">
          <SensitiveText text={insight.detail} />
        </p>
      )}
    </motion.article>
  );
}

function InvisibleExpenses({
  items,
  income,
  currency,
}: {
  items: AiFinancialAnalysisMetrics["repeatedSmallExpenses"];
  income: number;
  currency: string;
}) {
  const total = items.reduce((sum, item) => sum + item.total, 0);

  return (
    <motion.section variants={itemMotion} className="rounded-[20px] border border-border bg-muted/40 p-3.5 sm:p-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <SectionHeader eyebrow="Revelador" title="Gastos invisibles" icon={Eye} />
        {items.length > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-base font-semibold tabular-nums text-foreground">
              <SensitiveAmount value={formatMoney(total, currency)} />
            </p>
            <p className="text-[10px] text-muted-foreground">{formatPercent(percentage(total, income))} del ingreso</p>
          </div>
        )}
      </div>

      {items.length > 0 ? (
        <div className="space-y-1.5">
          {items.map((item, index) => (
            <InvisibleExpenseRow key={item.normalizedDescription} item={item} max={Math.max(total, item.total)} index={index} currency={currency} />
          ))}
        </div>
      ) : (
        <EmptyMicroState icon={Repeat} title="No aparecen gastos chicos repetidos" message="Cuando haya patrones de baja fricción, los vamos a traer acá." />
      )}
    </motion.section>
  );
}

function InvisibleExpenseRow({
  item,
  max,
  index,
  currency,
}: {
  item: AiFinancialAnalysisMetrics["repeatedSmallExpenses"][number];
  max: number;
  index: number;
  currency: string;
}) {
  const width = max > 0 ? clamp((item.total / max) * 100, 12, 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      className="rounded-xl border border-border bg-card/35 px-3 py-2.5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{item.description || "Movimiento repetido"}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {item.count}× · prom. <SensitiveAmount value={formatMoney(item.averageAmount, currency)} />
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
          <SensitiveAmount value={formatMoney(item.total, currency)} />
        </p>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted/50">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.7, ease: easeOut }}
          className="h-full rounded-full bg-gradient-to-r from-teal-300 via-sky-300 to-amber-200"
        />
      </div>
    </motion.div>
  );
}

function MonthPrediction({ metrics }: { metrics: AiFinancialAnalysisMetrics }) {
  const projectedSavings = metrics.income - metrics.projectedMonthEndExpense;
  const spendingRatio = percentage(metrics.projectedMonthEndExpense, metrics.income);
  const tone = projectedSavings >= 0 ? "emerald" : "rose";
  const styles = toneStyles[tone];
  const estimateLabel = approximateMoney(metrics.projectedMonthEndExpense, metrics.currency);
  const marginLabel = approximateMoney(projectedSavings, metrics.currency);

  return (
    <motion.section variants={itemMotion} className={`rounded-[20px] border p-4 ${styles.card}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <SectionHeader eyebrow="Estimación" title="Si el ritmo se mantiene parecido" icon={Zap} />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Basado en tu ritmo de gasto actual, podrías cerrar cerca de{" "}
            <span className="font-semibold tabular-nums text-foreground">
              <SensitiveAmount value={estimateLabel} />
            </span>{" "}
            en gastos este mes.
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground/75">
            Es una referencia contextual, no una predicción exacta. Cambia si registrás movimientos nuevos.
          </p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:w-[260px]">
          <PredictionChip label="Margen aprox." value={marginLabel} tone={tone} />
          <PredictionChip label="Uso de ingreso" value={formatPercent(spendingRatio)} tone={spendingRatio <= 80 ? "sky" : "amber"} />
        </div>
      </div>
    </motion.section>
  );
}

function MonthComparison({ comparison, currency }: { comparison: AiFinancialAnalysisComparison; currency: string }) {
  const categoryStories = buildCategoryStories(comparison, currency);

  return (
    <motion.section variants={itemMotion} className="rounded-[20px] border border-border bg-muted/40 p-3.5 sm:p-4">
      <SectionHeader eyebrow="Cambio" title="Contra el mes pasado" icon={CalendarDays} />
      {!comparison.available ? (
        <EmptyMicroState icon={CalendarDays} title="Todavía no hay una base anterior" message="Cuando exista un mes previo comparable, esta sección se vuelve narrativa." />
      ) : (
        <div className="mt-3 grid gap-2 grid-cols-2 lg:grid-cols-4">
          <ComparisonBlock
            label="Gastos"
            value={formatSignedMoney(comparison.expenseChangeAmount, currency)}
            detail={formatNullableChangePercent(comparison.expenseChangePercent)}
            isGood={comparison.expenseChangeAmount <= 0}
          />
          <ComparisonBlock
            label="Ahorro"
            value={formatSignedPercentagePoints(comparison.savingsRateChange)}
            detail="variación de tasa"
            isGood={comparison.savingsRateChange >= 0}
          />
          <ComparisonBlock
            label="Movilidad"
            value={formatSignedMoney(comparison.mobilityChangeAmount, currency)}
            detail={formatNullableChangePercent(comparison.mobilityChangePercent)}
            isGood={comparison.mobilityChangeAmount <= 0}
          />
          <ComparisonBlock
            label="Tarjeta"
            value={formatSignedPercentagePoints(comparison.creditCardRateChange)}
            detail="peso sobre gastos"
            isGood={comparison.creditCardRateChange <= 0}
          />
        </div>
      )}

      {categoryStories.length > 0 && (
        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
          {categoryStories.map((story) => (
            <p key={story.id} className="rounded-xl border border-border bg-card/35 px-3 py-2 text-xs leading-snug text-muted-foreground">
              <span className={story.good ? "text-emerald-400" : "text-amber-500"}>{story.title}</span>{" "}
              <SensitiveText text={story.message} />
            </p>
          ))}
        </div>
      )}
    </motion.section>
  );
}

function ActionPlan({
  recommendations,
  metrics,
}: {
  recommendations: AiFinancialAnalysis["recommendations"];
  metrics: AiFinancialAnalysisMetrics;
}) {
  const smartRecommendations = recommendations.length > 0 ? recommendations.slice(0, 3) : buildFallbackRecommendations(metrics);

  return (
    <motion.section variants={itemMotion} className="space-y-2">
      <SectionHeader eyebrow="Próximo paso" title="Recomendaciones accionables" icon={Target} />
      <div className="grid gap-2 lg:grid-cols-3">
        {smartRecommendations.map((item, index) => (
          <motion.article
            key={`${item.title}-${index}`}
            whileHover={{ y: -2 }}
            className="rounded-[18px] border border-border bg-card/45 p-3"
          >
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-muted/50 text-foreground">
              {index === 0 ? <Target className="h-4 w-4" aria-hidden="true" /> : index === 1 ? <ShieldCheck className="h-4 w-4" aria-hidden="true" /> : <Wallet className="h-4 w-4" aria-hidden="true" />}
            </div>
            <h3 className="text-balance text-sm font-semibold leading-tight text-foreground">
              <SensitiveText text={item.title} />
            </h3>
            <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
              <SensitiveText text={item.message} />
            </p>
            <p className="mt-2 text-xs font-semibold text-primary">
              <SensitiveText text={item.estimatedImpact} />
            </p>
          </motion.article>
        ))}
      </div>
    </motion.section>
  );
}

function CopilotEmptyState({
  error,
  isForbidden,
  onAnalyze,
  isLoading,
}: {
  error: string | null;
  isForbidden: boolean;
  onAnalyze: () => void;
  isLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="overflow-hidden rounded-[24px] border border-border bg-card/45 p-4 sm:p-5"
    >
      <div className="max-w-2xl">
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 text-primary">
          {isForbidden ? <ShieldAlert className="h-4 w-4" aria-hidden="true" /> : error ? <AlertTriangle className="h-4 w-4" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
        </div>
        <h2 className="text-balance text-xl font-semibold leading-tight text-foreground">
          {isForbidden ? "La IA todavía no está habilitada." : error ? "No pudimos traer tu lectura." : "Descubramos qué importa hoy."}
        </h2>
        <p className="mt-2 text-sm leading-snug text-muted-foreground">
          {isForbidden
            ? "Contactate con el administrador para activar el análisis mensual."
            : error ?? "Generá una lectura mensual con alertas, patrones y recomendaciones. Tu panorama financiero, sin convertirlo en un tablero técnico."}
        </p>
        {!isForbidden && (
          <Button onClick={onAnalyze} disabled={isLoading} className="mt-4 h-10 rounded-2xl bg-foreground text-background hover:opacity-90">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
            Analizar mi mes
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function PremiumLoading() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      <div className="relative overflow-hidden rounded-[24px] border border-border bg-card/45 p-5">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-11 w-11 animate-pulse rounded-2xl bg-muted" />
          <div className="space-y-2">
            <div className="h-3 w-32 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-48 animate-pulse rounded-full bg-muted/50" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-10 w-4/5 animate-pulse rounded-full bg-muted" />
          <div className="h-10 w-3/5 animate-pulse rounded-full bg-muted/50" />
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-muted/50" />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-44 animate-pulse rounded-[22px] border border-border bg-muted/40" />
        ))}
      </div>
    </motion.div>
  );
}

function SectionHeader({ eyebrow, title, icon: Icon }: { eyebrow: string; title: string; icon: IconType }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" aria-hidden="true" />
        <span>{eyebrow}</span>
      </div>
      <h2 className="text-balance text-base font-semibold leading-tight text-foreground">{title}</h2>
    </div>
  );
}

function SignalPill({ icon: Icon, label, tone }: { icon: IconType; label: string; tone: InsightTone }) {
  const styles = toneStyles[tone];

  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles.badge}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function PredictionChip({ label, value, tone }: { label: string; value: string; tone: InsightTone }) {
  const styles = toneStyles[tone];

  return (
    <div className={`min-w-0 rounded-xl border p-2.5 ${styles.card}`}>
      <p className="truncate text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold tabular-nums ${styles.text}`}>
        <SensitiveText text={value} />
      </p>
    </div>
  );
}

function ComparisonBlock({
  label,
  value,
  detail,
  isGood,
}: {
  label: string;
  value: string;
  detail: string;
  isGood: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card/35 p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="truncate text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
        {isGood ? <TrendingDown className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" /> : <TrendingUp className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />}
      </div>
      <p className={isGood ? "truncate text-sm font-semibold tabular-nums text-emerald-400" : "truncate text-sm font-semibold tabular-nums text-amber-500"}>
        <SensitiveText text={value} />
      </p>
      <p className="truncate text-[10px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function EmptyMicroState({ icon: Icon, title, message }: { icon: IconType; title: string; message: string }) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-card/35 px-3 py-3">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <p className="mt-2 text-sm font-semibold text-muted-foreground">{title}</p>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{message}</p>
    </div>
  );
}

function buildImportantInsights(
  analysis: AiFinancialAnalysis,
  metrics: AiFinancialAnalysisMetrics,
  comparison: AiFinancialAnalysisComparison | null,
): NarrativeInsight[] {
  const primaryAlert = [...analysis.alerts].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
  const bestPositive = analysis.positivePoints[0];
  const firstRisk = analysis.riskPoints[0];
  const firstRecommendation = analysis.recommendations[0];
  const topCategory = metrics.categoryExpensePercentages[0];

  const insights: NarrativeInsight[] = [];

  if (primaryAlert) {
    insights.push({
      id: `alert-${primaryAlert.title}`,
      title: primaryAlert.title,
      message: primaryAlert.message,
      detail: primaryAlert.severity === "high" ? "Prioridad alta porque puede cambiar el cierre del mes." : "Conviene mirarlo antes de que se vuelva hábito.",
      tone: primaryAlert.severity === "high" ? "rose" : primaryAlert.severity === "medium" ? "amber" : "sky",
      priority: primaryAlert.severity === "high" ? "Alta" : "Media",
      icon: primaryAlert.severity === "high" ? ShieldAlert : AlertTriangle,
    });
  }

  if (metrics.mobilityTotal > 0) {
    insights.push({
      id: "mobility",
      title: `Movilidad pesa ${formatPercent(metrics.mobilityRate)} de tus ingresos.`,
      message: `Este mes suma ${formatMoney(metrics.mobilityTotal, metrics.currency)} entre transporte, auto o categorías asociadas.`,
      detail: comparison?.available ? `Contra el mes anterior: ${formatSignedMoney(comparison.mobilityChangeAmount, metrics.currency)}.` : "Es una de las señales más fáciles de optimizar cuando crece sin sentirse.",
      tone: metrics.mobilityRate >= 18 ? "amber" : "sky",
      priority: metrics.mobilityRate >= 18 ? "Alta" : "Media",
      icon: Car,
    });
  }

  if (topCategory) {
    insights.push({
      id: `category-${topCategory.name}`,
      title: `${topCategory.name} marca el ritmo del mes.`,
      message: `Representa ${formatPercent(topCategory.percentage)} de tus gastos actuales.`,
      detail: `${formatMoney(topCategory.total, metrics.currency)} en ${metrics.expensesByCategory.find((category) => category.name === topCategory.name)?.count ?? 0} movimientos.`,
      tone: topCategory.percentage >= 30 ? "amber" : "zinc",
      priority: topCategory.percentage >= 30 ? "Media" : "Suave",
      icon: CircleDollarSign,
    });
  }

  if (comparison?.available) {
    insights.push({
      id: "month-change",
      title: comparison.expenseChangeAmount <= 0 ? "Gastaste menos que el mes pasado." : "El gasto subió contra el mes pasado.",
      message: `${comparison.expenseChangeAmount <= 0 ? "Bajaste" : "Subiste"} ${formatMoney(Math.abs(comparison.expenseChangeAmount), metrics.currency)} en gastos mensuales.`,
      detail: `La tasa de ahorro cambió ${formatSignedPercentagePoints(comparison.savingsRateChange)}.`,
      tone: comparison.expenseChangeAmount <= 0 ? "emerald" : "amber",
      priority: Math.abs(comparison.expenseChangeAmount) > metrics.income * 0.08 ? "Alta" : "Media",
      icon: comparison.expenseChangeAmount <= 0 ? TrendingDown : TrendingUp,
    });
  }

  if (firstRecommendation) {
    insights.push({
      id: `recommendation-${firstRecommendation.title}`,
      title: firstRecommendation.title,
      message: firstRecommendation.message,
      detail: firstRecommendation.estimatedImpact,
      tone: "violet",
      priority: "Media",
      icon: Target,
    });
  }

  if (bestPositive) {
    insights.push({
      id: `positive-${bestPositive.title}`,
      title: bestPositive.title,
      message: bestPositive.message,
      detail: "Señal positiva detectada por tu lectura mensual.",
      tone: "emerald",
      priority: "Suave",
      icon: BadgeCheck,
    });
  }

  if (firstRisk) {
    insights.push({
      id: `risk-${firstRisk.title}`,
      title: firstRisk.title,
      message: firstRisk.message,
      detail: "Riesgo contextual para monitorear durante el resto del mes.",
      tone: "rose",
      priority: "Alta",
      icon: ShieldAlert,
    });
  }

  if (metrics.creditCardExpenseRate > 0) {
    insights.push({
      id: "credit-card",
      title: "La tarjeta está dejando huella.",
      message: `Representa ${formatPercent(metrics.creditCardExpenseRate)} de tus gastos del mes.`,
      detail: "Cuando este número sube, el gasto suele sentirse más liviano de lo que realmente es.",
      tone: metrics.creditCardExpenseRate >= 45 ? "rose" : "zinc",
      priority: metrics.creditCardExpenseRate >= 45 ? "Alta" : "Suave",
      icon: CreditCard,
    });
  }

  return insights.slice(0, 6);
}

function buildHeroNarrative(
  analysis: AiFinancialAnalysis,
  metrics: AiFinancialAnalysisMetrics,
  comparison: AiFinancialAnalysisComparison | null,
) {
  const score = Math.round(analysis.score);
  const trend = comparison?.available
    ? comparison.balanceChangeAmount >= 0
      ? `Vas mejor que ${formatMonthLabel(comparison.previousMonth)}`
      : `Peor balance que ${formatMonthLabel(comparison.previousMonth)}`
    : metrics.balance >= 0
      ? "El mes viene en positivo"
      : "El mes pide atención";

  if (score >= 78 && metrics.savingsRate > 0) {
    return {
      title: "Este es tu mes.",
      subtitle: "Tu dinero se ve estable y la lectura detecta margen para cerrar con ahorro sin hacer movimientos dramáticos.",
      tone: "emerald" as InsightTone,
      trend,
    };
  }

  if (metrics.mobilityRate >= 18) {
    return {
      title: "El auto está hablando fuerte.",
      subtitle: "La movilidad está ocupando demasiado espacio en el mes. No es alarma total, pero sí una señal que conviene mirar hoy.",
      tone: "amber" as InsightTone,
      trend,
    };
  }

  if (metrics.projectedMonthEndExpense > metrics.income && metrics.income > 0) {
    return {
      title: "Bajemos un cambio.",
      subtitle: "Si el ritmo sigue igual, el cierre puede quedar por encima de tus ingresos. Todavía estás a tiempo de corregirlo.",
      tone: "rose" as InsightTone,
      trend,
    };
  }

  return {
    title: "Esto es lo que deberías saber hoy.",
    subtitle: analysis.summary,
    tone: getScoreTone(score),
    trend,
  };
}

function buildCategoryStories(comparison: AiFinancialAnalysisComparison, currency: string) {
  if (!comparison.available) return [];

  const biggestUp = comparison.categoryChanges
    .filter((category) => category.changeAmount > 0)
    .sort((a, b) => b.changeAmount - a.changeAmount)[0];
  const biggestDown = comparison.categoryChanges
    .filter((category) => category.changeAmount < 0)
    .sort((a, b) => a.changeAmount - b.changeAmount)[0];

  return [
    biggestDown && {
      id: `down-${biggestDown.category}`,
      title: `${biggestDown.category} bajó.`,
      message: `Ahorraste ${formatMoney(Math.abs(biggestDown.changeAmount), currency)} contra el mes pasado.`,
      good: true,
    },
    biggestUp && {
      id: `up-${biggestUp.category}`,
      title: `${biggestUp.category} subió fuerte.`,
      message: `Sumó ${formatMoney(biggestUp.changeAmount, currency)} más que antes.`,
      good: false,
    },
  ].filter(Boolean) as Array<{ id: string; title: string; message: string; good: boolean }>;
}

function buildFallbackRecommendations(metrics: AiFinancialAnalysisMetrics) {
  const mobilitySavings = Math.round(metrics.mobilityTotal * 0.15);
  const invisibleSavings = Math.round(metrics.repeatedSmallExpenses.reduce((sum, item) => sum + item.total, 0) * 0.25);
  const fixedPressure = metrics.fixedExpenseRate >= 45;

  return [
    {
      title: "Recortá una fricción chica esta semana.",
      message: "Elegí un gasto invisible repetido y pausalo por siete días para medir impacto sin cambiar todo tu estilo de vida.",
      estimatedImpact: invisibleSavings > 0 ? `Impacto posible: ${formatMoney(invisibleSavings, metrics.currency)}.` : "Impacto posible: mejora de control.",
    },
    {
      title: fixedPressure ? "Revisá los gastos fijos antes de sumar variables." : "Protegé tu tasa de ahorro.",
      message: fixedPressure ? "Tus gastos fijos ya ocupan una parte sensible del ingreso. La próxima mejora debería venir de ahí." : "El mes puede cerrar mejor si mantenés el ritmo actual y evitás gastos de baja intención.",
      estimatedImpact: `Fijos / ingresos: ${formatPercent(metrics.fixedExpenseRate)}.`,
    },
    {
      title: "Poné un techo de movilidad.",
      message: "Si movilidad sigue creciendo, se come margen sin parecer un gran gasto individual.",
      estimatedImpact: mobilitySavings > 0 ? `Reduciendo 15%: ${formatMoney(mobilitySavings, metrics.currency)}.` : "Impacto posible: menor fuga diaria.",
    },
  ];
}

function getScoreTone(score: number): InsightTone {
  if (score >= 78) return "emerald";
  if (score >= 58) return "sky";
  if (score >= 42) return "amber";
  return "rose";
}

function getScoreLabel(score: number) {
  if (score >= 78) return "alta";
  if (score >= 58) return "media";
  if (score >= 42) return "ajustada";
  return "sensible";
}

function severityRank(severity: AiFinancialAnalysis["alerts"][number]["severity"]) {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function percentage(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return (value / total) * 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return month;

  return new Intl.DateTimeFormat("es-AR", { month: "long" }).format(new Date(year, monthNumber - 1, 1));
}

function formatMoney(value: number, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function approximateMoney(value: number, currency = "ARS") {
  const abs = Math.abs(value);
  const step = abs >= 100_000 ? 10_000 : abs >= 10_000 ? 1_000 : abs >= 1_000 ? 500 : 100;
  const rounded = Math.round(value / step) * step || (value === 0 ? 0 : Math.sign(value) * step);
  return formatMoney(rounded, currency);
}

function formatSignedMoney(value: number, currency = "ARS") {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatMoney(value, currency)}`;
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 1,
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
