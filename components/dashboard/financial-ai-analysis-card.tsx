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
  Gauge,
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
    icon: "bg-emerald-400/12 text-emerald-200",
    badge: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    text: "text-emerald-200",
  },
  amber: {
    card: "border-amber-300/20 bg-amber-300/[0.08]",
    glow: "shadow-[0_18px_60px_rgba(251,191,36,0.08)]",
    icon: "bg-amber-300/12 text-amber-100",
    badge: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    text: "text-amber-100",
  },
  rose: {
    card: "border-rose-300/20 bg-rose-400/[0.08]",
    glow: "shadow-[0_18px_60px_rgba(251,113,133,0.08)]",
    icon: "bg-rose-300/12 text-rose-100",
    badge: "border-rose-300/20 bg-rose-300/10 text-rose-100",
    text: "text-rose-100",
  },
  sky: {
    card: "border-sky-300/20 bg-sky-400/[0.08]",
    glow: "shadow-[0_18px_60px_rgba(56,189,248,0.08)]",
    icon: "bg-sky-300/12 text-sky-100",
    badge: "border-sky-300/20 bg-sky-300/10 text-sky-100",
    text: "text-sky-100",
  },
  violet: {
    card: "border-violet-300/20 bg-violet-400/[0.08]",
    glow: "shadow-[0_18px_60px_rgba(167,139,250,0.08)]",
    icon: "bg-violet-300/12 text-violet-100",
    badge: "border-violet-300/20 bg-violet-300/10 text-violet-100",
    text: "text-violet-100",
  },
  zinc: {
    card: "border-white/10 bg-white/[0.055]",
    glow: "shadow-[0_18px_60px_rgba(255,255,255,0.03)]",
    icon: "bg-white/10 text-zinc-100",
    badge: "border-white/10 bg-white/10 text-zinc-200",
    text: "text-zinc-100",
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
      setIsOpen(true);
    } catch {
      setError("Error de red. Intentá nuevamente en unos segundos.");
    } finally {
      setIsLoading(false);
    }
  }

  const statusLabel = isStale ? "Hay movimientos nuevos" : isCached ? "Informe guardado" : analysis ? "Actualizado" : "Listo para analizar";

  return (
    <section className="mb-7 overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.16),transparent_31%),radial-gradient(circle_at_82%_12%,rgba(251,191,36,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] p-1 shadow-[0_30px_120px_rgba(0,0,0,0.38)]">
      <div className="rounded-[24px] bg-background/78 px-4 py-4 backdrop-blur-xl sm:px-6 sm:py-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="group flex min-w-0 items-center gap-3 rounded-2xl text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => analysis && metrics ? setIsOpen((current) => !current) : undefined}
            aria-expanded={analysis && metrics ? isOpen : undefined}
            aria-controls="financial-copilot-content"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-teal-100 shadow-inner">
              <Brain className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Financial Copilot</p>
                <Badge className="border-white/10 bg-white/8 text-[11px] text-zinc-300">{statusLabel}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">Lo importante de tu dinero, sin ruido.</p>
            </div>
            {analysis && metrics && (
              <ChevronDown
                className={`ml-auto h-4 w-4 shrink-0 text-zinc-500 transition duration-300 group-hover:text-zinc-300 ${isOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            )}
          </button>

          <div className="flex flex-col gap-2 sm:flex-row">
            {analysis && metrics && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen((current) => !current)}
                className="h-11 w-full rounded-2xl border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10 sm:w-auto"
                aria-expanded={isOpen}
                aria-controls="financial-copilot-content"
              >
                <ChevronDown className={`h-4 w-4 transition duration-300 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                {isOpen ? "Ocultar" : "Ver lectura"}
              </Button>
            )}
            <Button
              onClick={handleAnalyze}
              disabled={isLoading || isForbidden}
              className="h-11 w-full rounded-2xl bg-white text-zinc-950 shadow-[0_16px_42px_rgba(255,255,255,0.12)] hover:bg-zinc-100 sm:w-auto"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
              {analysis ? "Actualizar lectura" : "Analizar con IA"}
            </Button>
          </div>
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
                isStale={isStale}
                onOpen={() => setIsOpen(true)}
              />
            ) : analysis && metrics ? (
              <CopilotExperience
                key="experience"
                analysis={analysis}
                metrics={metrics}
                comparison={comparison}
                isStale={isStale}
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
  isStale,
  onOpen,
}: {
  analysis: AiFinancialAnalysis;
  metrics: AiFinancialAnalysisMetrics;
  comparison: AiFinancialAnalysisComparison | null;
  isStale: boolean;
  onOpen: () => void;
}) {
  const hero = useMemo(() => buildHeroNarrative(analysis, metrics, comparison), [analysis, metrics, comparison]);
  const insights = useMemo(() => buildImportantInsights(analysis, metrics, comparison), [analysis, metrics, comparison]);
  const primaryInsight = insights[0];
  const score = clamp(Math.round(analysis.score), 0, 100);
  const scoreTone = getScoreTone(score);
  const scoreStyle = toneStyles[scoreTone];

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: easeOut }}
      onClick={onOpen}
      className="group w-full overflow-hidden rounded-[24px] border border-white/10 bg-zinc-950/45 p-4 text-left transition hover:border-white/20 hover:bg-zinc-950/55 sm:p-5"
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className={`${scoreStyle.badge}`}>Score {score}/100</Badge>
            {isStale && <Badge className="border-amber-300/20 bg-amber-300/10 text-amber-100">Hay cambios nuevos</Badge>}
            <Badge className="border-white/10 bg-white/8 text-zinc-300">Tocar para desplegar</Badge>
          </div>
          <h2 className="text-balance text-2xl font-semibold leading-tight text-white sm:text-3xl">{hero.title}</h2>
          <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-6 text-zinc-400">{hero.subtitle}</p>
          {primaryInsight && (
            <div className="mt-4 flex min-w-0 items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.045] px-3 py-2.5">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneStyles[primaryInsight.tone].icon}`}>
                <primaryInsight.icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">{primaryInsight.title}</p>
                <p className="truncate text-xs text-zinc-500">{primaryInsight.message}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
          <div className={`relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border ${scoreStyle.card}`}>
            <div
              className="absolute inset-2 rounded-full"
              style={{
                background: `conic-gradient(${scoreColor(score)} ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
              }}
            />
            <div className="absolute inset-4 rounded-full bg-zinc-950" />
            <span className={`relative text-xl font-semibold tabular-nums ${scoreStyle.text}`}>{score}</span>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs font-medium text-zinc-200 transition group-hover:bg-white/12">
            Abrir
            <ChevronDown className="-rotate-90 h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function CopilotExperience({
  analysis,
  metrics,
  comparison,
  isStale,
}: {
  analysis: AiFinancialAnalysis;
  metrics: AiFinancialAnalysisMetrics;
  comparison: AiFinancialAnalysisComparison | null;
  isStale: boolean;
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
      className="space-y-5"
    >
      <FinancialCopilotHero hero={hero} analysis={analysis} metrics={metrics} comparison={comparison} isStale={isStale} />
      <ImportantInsights insights={insights} />
      <InvisibleExpenses items={invisibleExpenses} income={metrics.income} />
      <MonthPrediction metrics={metrics} />
      {comparison && <MonthComparison comparison={comparison} />}
      <ActionPlan recommendations={analysis.recommendations} metrics={metrics} />
    </motion.div>
  );
}

function FinancialCopilotHero({
  hero,
  analysis,
  metrics,
  comparison,
  isStale,
}: {
  hero: { title: string; subtitle: string; tone: InsightTone; trend: string };
  analysis: AiFinancialAnalysis;
  metrics: AiFinancialAnalysisMetrics;
  comparison: AiFinancialAnalysisComparison | null;
  isStale: boolean;
}) {
  const score = clamp(Math.round(analysis.score), 0, 100);
  const scoreTone = getScoreTone(score);
  const scoreStyle = toneStyles[scoreTone];
  const trendIsPositive = comparison?.available ? comparison.balanceChangeAmount >= 0 : metrics.balance >= 0;

  return (
    <motion.div variants={itemMotion} className="relative overflow-hidden rounded-[24px] border border-white/10 bg-zinc-950/60 p-5 sm:p-7">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(45,212,191,0.22),transparent_34%),radial-gradient(circle_at_92%_12%,rgba(248,250,252,0.11),transparent_25%)]" />
      <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full border border-white/10 bg-white/[0.03]" />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_220px] lg:items-end">
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Badge className="border-white/10 bg-white/10 text-zinc-200">Tu dinero este mes</Badge>
            {isStale && <Badge className="border-amber-300/20 bg-amber-300/10 text-amber-100">Revisar cambios</Badge>}
          </div>
          <h2 className="max-w-2xl text-balance text-3xl font-semibold leading-[1.03] text-white sm:text-5xl">
            {hero.title}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-zinc-300 sm:text-lg">
            {hero.subtitle}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <SignalPill icon={trendIsPositive ? ArrowUpRight : ArrowDownRight} label={hero.trend} tone={trendIsPositive ? "emerald" : "amber"} />
            <SignalPill icon={Gauge} label={`Score ${score}/100`} tone={scoreTone} />
            <SignalPill icon={Wallet} label={`${formatPercent(metrics.savingsRate)} ahorro`} tone={metrics.savingsRate >= 0 ? "sky" : "rose"} />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[220px] lg:mx-0">
          <div className={`relative aspect-square rounded-full border ${scoreStyle.card} ${scoreStyle.glow} p-4`}>
            <div
              className="absolute inset-4 rounded-full"
              style={{
                background: `conic-gradient(${scoreColor(score)} ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
              }}
            />
            <div className="absolute inset-8 rounded-full bg-zinc-950/95 shadow-inner" />
            <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
              <p className="text-[11px] font-semibold uppercase text-zinc-500">Estado general</p>
              <p className={`mt-2 text-5xl font-semibold tabular-nums ${scoreStyle.text}`}>{score}</p>
              <p className="mt-1 text-xs text-zinc-500">lectura IA</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ImportantInsights({ insights }: { insights: NarrativeInsight[] }) {
  return (
    <motion.section variants={itemMotion} className="space-y-3">
      <SectionHeader eyebrow="Hoy importa" title="Insights importantes" icon={Sparkles} />
      <div className="grid gap-3 lg:grid-cols-3">
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
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className={`min-w-0 rounded-[22px] border p-4 ${styles.card} ${styles.glow} ${featured ? "lg:col-span-2 lg:p-5" : ""}`}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${styles.icon}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <Badge className={`${styles.badge} shrink-0`}>{insight.priority}</Badge>
      </div>
      <h3 className={`text-balance text-xl font-semibold leading-tight ${styles.text}`}>{insight.title}</h3>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{insight.message}</p>
      <p className="mt-4 text-xs leading-5 text-zinc-500">{insight.detail}</p>
    </motion.article>
  );
}

function InvisibleExpenses({
  items,
  income,
}: {
  items: AiFinancialAnalysisMetrics["repeatedSmallExpenses"];
  income: number;
}) {
  const total = items.reduce((sum, item) => sum + item.total, 0);

  return (
    <motion.section variants={itemMotion} className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4 sm:p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <SectionHeader eyebrow="Revelador" title="Gastos invisibles" icon={Eye} />
        {items.length > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-lg font-semibold tabular-nums text-white">{formatMoney(total)}</p>
            <p className="text-[11px] text-zinc-500">{formatPercent(percentage(total, income))} del ingreso</p>
          </div>
        )}
      </div>

      {items.length > 0 ? (
        <div className="space-y-2.5">
          {items.map((item, index) => (
            <InvisibleExpenseRow key={item.normalizedDescription} item={item} max={Math.max(total, item.total)} index={index} />
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
}: {
  item: AiFinancialAnalysisMetrics["repeatedSmallExpenses"][number];
  max: number;
  index: number;
}) {
  const width = max > 0 ? clamp((item.total / max) * 100, 12, 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      className="rounded-2xl border border-white/8 bg-zinc-950/35 p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{item.description || "Movimiento repetido"}</p>
          <p className="mt-1 truncate text-xs text-zinc-500">{item.count} veces · promedio {formatMoney(item.averageAmount)}</p>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-zinc-100">{formatMoney(item.total)}</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
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
  const bars = buildProjectionBars(metrics.dailyAverageExpense, metrics.projectedMonthEndExpense);
  const tone = projectedSavings >= 0 ? "emerald" : "rose";
  const styles = toneStyles[tone];

  return (
    <motion.section variants={itemMotion} className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
      <div className={`rounded-[24px] border p-5 ${styles.card}`}>
        <SectionHeader eyebrow="Predicción" title="Si seguís así..." icon={Zap} />
        <p className="mt-5 text-3xl font-semibold leading-tight text-white tabular-nums">
          {formatMoney(metrics.projectedMonthEndExpense)}
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-400">sería tu gasto estimado al cierre del mes.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <PredictionChip label="Ahorro estimado" value={formatMoney(projectedSavings)} tone={tone} />
          <PredictionChip label="Uso de ingreso" value={formatPercent(spendingRatio)} tone={spendingRatio <= 80 ? "sky" : "amber"} />
        </div>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-zinc-950/40 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">Pulso del mes</p>
          <Badge className="border-white/10 bg-white/8 text-zinc-300">Proyección suave</Badge>
        </div>
        <div className="flex h-36 items-end gap-2">
          {bars.map((bar, index) => (
            <motion.div
              key={`${bar}-${index}`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: `${bar}%`, opacity: 1 }}
              transition={{ delay: index * 0.04, duration: 0.45, ease: easeOut }}
              className="flex-1 rounded-t-lg bg-gradient-to-t from-white/12 to-teal-200/80"
            />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
          <span>Hoy</span>
          <span>Cierre estimado</span>
        </div>
      </div>
    </motion.section>
  );
}

function MonthComparison({ comparison }: { comparison: AiFinancialAnalysisComparison }) {
  const categoryStories = buildCategoryStories(comparison);

  return (
    <motion.section variants={itemMotion} className="rounded-[24px] border border-white/10 bg-white/[0.045] p-4 sm:p-5">
      <SectionHeader eyebrow="Cambio" title="Contra el mes pasado" icon={CalendarDays} />
      {!comparison.available ? (
        <EmptyMicroState icon={CalendarDays} title="Todavía no hay una base anterior" message="Cuando exista un mes previo comparable, esta sección se vuelve narrativa." />
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ComparisonBlock
            label="Gastos"
            value={formatSignedMoney(comparison.expenseChangeAmount)}
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
            value={formatSignedMoney(comparison.mobilityChangeAmount)}
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
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {categoryStories.map((story) => (
            <p key={story.id} className="rounded-2xl border border-white/8 bg-zinc-950/35 px-3 py-2.5 text-sm leading-6 text-zinc-300">
              <span className={story.good ? "text-emerald-200" : "text-amber-100"}>{story.title}</span> {story.message}
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
    <motion.section variants={itemMotion} className="space-y-3">
      <SectionHeader eyebrow="Próximo paso" title="Recomendaciones accionables" icon={Target} />
      <div className="grid gap-3 lg:grid-cols-3">
        {smartRecommendations.map((item, index) => (
          <motion.article
            key={`${item.title}-${index}`}
            whileHover={{ y: -4 }}
            className="rounded-[22px] border border-white/10 bg-zinc-950/45 p-4"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8 text-white">
              {index === 0 ? <Target className="h-5 w-5" aria-hidden="true" /> : index === 1 ? <ShieldCheck className="h-5 w-5" aria-hidden="true" /> : <Wallet className="h-5 w-5" aria-hidden="true" />}
            </div>
            <h3 className="text-balance text-lg font-semibold leading-tight text-white">{item.title}</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{item.message}</p>
            <p className="mt-4 text-sm font-semibold text-teal-100">{item.estimatedImpact}</p>
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
      className="overflow-hidden rounded-[24px] border border-white/10 bg-zinc-950/45 p-5 sm:p-7"
    >
      <div className="max-w-2xl">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8 text-teal-100">
          {isForbidden ? <ShieldAlert className="h-6 w-6" aria-hidden="true" /> : error ? <AlertTriangle className="h-6 w-6" aria-hidden="true" /> : <Sparkles className="h-6 w-6" aria-hidden="true" />}
        </div>
        <h2 className="text-balance text-3xl font-semibold leading-tight text-white">
          {isForbidden ? "La IA todavía no está habilitada." : error ? "No pudimos traer tu lectura." : "Brandon, descubramos qué importa hoy."}
        </h2>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          {isForbidden
            ? "Contactate con el administrador para activar Financial Copilot."
            : error ?? "Generá una lectura mensual con alertas, patrones y recomendaciones sin convertir tu dinero en un tablero técnico."}
        </p>
        {!isForbidden && (
          <Button onClick={onAnalyze} disabled={isLoading} className="mt-6 h-11 rounded-2xl bg-white text-zinc-950 hover:bg-zinc-100">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
            Crear lectura inteligente
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
      <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-zinc-950/45 p-5">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-11 w-11 animate-pulse rounded-2xl bg-white/10" />
          <div className="space-y-2">
            <div className="h-3 w-32 animate-pulse rounded-full bg-white/10" />
            <div className="h-3 w-48 animate-pulse rounded-full bg-white/8" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-10 w-4/5 animate-pulse rounded-full bg-white/10" />
          <div className="h-10 w-3/5 animate-pulse rounded-full bg-white/8" />
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/8" />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-44 animate-pulse rounded-[22px] border border-white/10 bg-white/[0.045]" />
        ))}
      </div>
    </motion.div>
  );
}

function SectionHeader({ eyebrow, title, icon: Icon }: { eyebrow: string; title: string; icon: IconType }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase text-zinc-500">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{eyebrow}</span>
      </div>
      <h2 className="text-balance text-xl font-semibold leading-tight text-white">{title}</h2>
    </div>
  );
}

function SignalPill({ icon: Icon, label, tone }: { icon: IconType; label: string; tone: InsightTone }) {
  const styles = toneStyles[tone];

  return (
    <span className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${styles.badge}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function PredictionChip({ label, value, tone }: { label: string; value: string; tone: InsightTone }) {
  const styles = toneStyles[tone];

  return (
    <div className={`min-w-0 rounded-2xl border p-3 ${styles.card}`}>
      <p className="truncate text-[11px] font-semibold uppercase text-zinc-500">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold tabular-nums ${styles.text}`}>{value}</p>
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
    <div className="min-w-0 rounded-2xl border border-white/8 bg-zinc-950/35 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold uppercase text-zinc-500">{label}</p>
        {isGood ? <TrendingDown className="h-4 w-4 shrink-0 text-emerald-200" aria-hidden="true" /> : <TrendingUp className="h-4 w-4 shrink-0 text-amber-100" aria-hidden="true" />}
      </div>
      <p className={isGood ? "truncate text-base font-semibold tabular-nums text-emerald-100" : "truncate text-base font-semibold tabular-nums text-amber-100"}>
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function EmptyMicroState({ icon: Icon, title, message }: { icon: IconType; title: string; message: string }) {
  return (
    <div className="mt-5 rounded-2xl border border-white/8 bg-zinc-950/35 p-4">
      <Icon className="h-5 w-5 text-zinc-500" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-zinc-200">{title}</p>
      <p className="mt-1 text-sm leading-6 text-zinc-500">{message}</p>
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
      message: `Este mes suma ${formatMoney(metrics.mobilityTotal)} entre transporte, auto o categorías asociadas.`,
      detail: comparison?.available ? `Contra el mes anterior: ${formatSignedMoney(comparison.mobilityChangeAmount)}.` : "Es una de las señales más fáciles de optimizar cuando crece sin sentirse.",
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
      detail: `${formatMoney(topCategory.total)} en ${metrics.expensesByCategory.find((category) => category.name === topCategory.name)?.count ?? 0} movimientos.`,
      tone: topCategory.percentage >= 30 ? "amber" : "zinc",
      priority: topCategory.percentage >= 30 ? "Media" : "Suave",
      icon: CircleDollarSign,
    });
  }

  if (comparison?.available) {
    insights.push({
      id: "month-change",
      title: comparison.expenseChangeAmount <= 0 ? "Gastaste menos que el mes pasado." : "El gasto subió contra el mes pasado.",
      message: `${comparison.expenseChangeAmount <= 0 ? "Bajaste" : "Subiste"} ${formatMoney(Math.abs(comparison.expenseChangeAmount))} en gastos mensuales.`,
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
      title: "Brandon, este es tu mes.",
      subtitle: "Tu dinero se ve estable y la lectura detecta margen para cerrar con ahorro sin hacer movimientos dramáticos.",
      tone: "emerald" as InsightTone,
      trend,
    };
  }

  if (metrics.mobilityRate >= 18) {
    return {
      title: "Brandon, el auto está hablando fuerte.",
      subtitle: "La movilidad está ocupando demasiado espacio en el mes. No es alarma total, pero sí una señal que conviene mirar hoy.",
      tone: "amber" as InsightTone,
      trend,
    };
  }

  if (metrics.projectedMonthEndExpense > metrics.income && metrics.income > 0) {
    return {
      title: "Brandon, bajemos un cambio.",
      subtitle: "Si el ritmo sigue igual, el cierre puede quedar por encima de tus ingresos. Todavía estás a tiempo de corregirlo.",
      tone: "rose" as InsightTone,
      trend,
    };
  }

  return {
    title: "Brandon, esto es lo que deberías saber hoy.",
    subtitle: analysis.summary,
    tone: getScoreTone(score),
    trend,
  };
}

function buildProjectionBars(dailyAverage: number, projected: number) {
  const base = Math.max(dailyAverage, projected / 30, 1);

  return Array.from({ length: 14 }, (_, index) => {
    const wave = 0.72 + Math.sin(index * 0.78) * 0.16 + (index / 14) * 0.26;
    return clamp((base * wave / base) * 72, 22, 96);
  });
}

function buildCategoryStories(comparison: AiFinancialAnalysisComparison) {
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
      message: `Ahorraste ${formatMoney(Math.abs(biggestDown.changeAmount))} contra el mes pasado.`,
      good: true,
    },
    biggestUp && {
      id: `up-${biggestUp.category}`,
      title: `${biggestUp.category} subió fuerte.`,
      message: `Sumó ${formatMoney(biggestUp.changeAmount)} más que antes.`,
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
      estimatedImpact: invisibleSavings > 0 ? `Impacto posible: ${formatMoney(invisibleSavings)}.` : "Impacto posible: mejora de control.",
    },
    {
      title: fixedPressure ? "Revisá los gastos fijos antes de sumar variables." : "Protegé tu tasa de ahorro.",
      message: fixedPressure ? "Tus gastos fijos ya ocupan una parte sensible del ingreso. La próxima mejora debería venir de ahí." : "El mes puede cerrar mejor si mantenés el ritmo actual y evitás gastos de baja intención.",
      estimatedImpact: `Fijos / ingresos: ${formatPercent(metrics.fixedExpenseRate)}.`,
    },
    {
      title: "Poné un techo de movilidad.",
      message: "Si movilidad sigue creciendo, se come margen sin parecer un gran gasto individual.",
      estimatedImpact: mobilitySavings > 0 ? `Reduciendo 15%: ${formatMoney(mobilitySavings)}.` : "Impacto posible: menor fuga diaria.",
    },
  ];
}

function getScoreTone(score: number): InsightTone {
  if (score >= 78) return "emerald";
  if (score >= 58) return "sky";
  if (score >= 42) return "amber";
  return "rose";
}

function scoreColor(score: number) {
  if (score >= 78) return "rgba(110,231,183,0.92)";
  if (score >= 58) return "rgba(125,211,252,0.92)";
  if (score >= 42) return "rgba(253,230,138,0.92)";
  return "rgba(253,164,175,0.92)";
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
