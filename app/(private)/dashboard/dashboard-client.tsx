"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeftCircle,
  ArrowRightCircle,
  ChevronDown,
  Plus,
  ReceiptText,
} from "lucide-react";
import { SensitiveAmount, SensitiveText } from "@/components/app/sensitive-amount";
import { useUser } from "@/components/app/user-context";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { FinancialAiAnalysisCard } from "@/components/dashboard/financial-ai-analysis-card";
import { WeeklyReflectionCard } from "@/components/dashboard/weekly-reflection-card";
import {
  PremiumCard,
  PremiumCardContent,
} from "@/components/ui-v2/premium-card";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { MetricStrip, FinancialHealthStrip } from "@/components/dashboard/metric-strip";
import { MonthlySignals } from "@/components/dashboard/monthly-signals";
import { ExpenseTypeBreakdown } from "@/components/dashboard/expense-type-breakdown";
import { MonthProjection } from "@/components/dashboard/month-projection";
import { ExpenseCategoryExplorer } from "@/components/dashboard/expense-category-explorer";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { ActivityPreview } from "@/components/dashboard/activity-preview";
import { GettingStartedCard } from "@/components/dashboard/getting-started-card";
import { ContextualEntryPoints } from "@/components/dashboard/contextual-entry-points";
import { useSectionCollapse } from "@/hooks/use-section-collapse";
import { trackProductEvent } from "@/lib/observability/client";
import {
  MONTH_NAMES,
  formatMoney,
  getTimeContext,
  getAmbientHint,
  getIncomeInsight,
  getExpensesInsight,
  getReservedInsight,
  getObligationsInsight,
  sectionReveal,
} from "./utils";
import type { DashboardSummary } from "./types";

/* ── Local UI primitives ─────────────────────────────────────────────────── */

function SectionCollapseButton({
  title,
  summary,
  expanded,
  onToggle,
}: {
  title: string;
  summary?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
        {!expanded && summary ? (
          <span className="truncate text-[11px] text-muted-foreground">— {summary}</span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/30 text-muted-foreground transition hover:bg-muted/70 hover:text-muted-foreground"
        aria-label={expanded ? `Colapsar ${title}` : `Expandir ${title}`}
        aria-expanded={expanded}
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

function AmbientSignal({ text, celebratory = false }: { text: string; celebratory?: boolean }) {
  return (
    <div className="mb-5 flex items-center gap-3 sm:mb-8">
      <span
        className={`h-px flex-1 ${celebratory ? "bg-emerald-500/[0.12]" : "bg-muted/30"}`}
        aria-hidden="true"
      />
      <p
        className={`shrink-0 text-[11px] italic tracking-wide ${
          celebratory ? "text-emerald-500/70" : "text-muted-foreground"
        }`}
      >
        {text}
      </p>
      <span
        className={`h-px flex-1 ${celebratory ? "bg-emerald-500/[0.12]" : "bg-muted/30"}`}
        aria-hidden="true"
      />
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */

export function DashboardClient() {
  const now = new Date();
  const { userName } = useUser();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [selectedExpenseCategoryPreference, setSelectedExpenseCategoryPreference] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const firstName = userName?.split(" ")[0] ?? null;
  const [timeContext] = useState(() => getTimeContext(firstName));
  const shouldReduceMotion = useReducedMotion();
  const sectionDistribucion = useSectionCollapse("distribucion", false);
  const sectionMapa = useSectionCollapse("mapa", false);
  const sectionMovimientos = useSectionCollapse("movimientos", true);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  useEffect(() => {
    async function loadSummary() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ year: String(year), month: String(month) });
        const response = await fetch(`/api/dashboard/summary?${params.toString()}`);
        const payload = (await response.json()) as { data?: DashboardSummary; error?: string };
        if (!response.ok) {
          setError(payload.error ?? "No se pudo cargar el dashboard.");
          return;
        }
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
    <div className="mb-4">
      {isCurrentMonth && (
        <p className="mb-3 text-sm font-medium text-muted-foreground" suppressHydrationWarning>
          {timeContext.greeting}
        </p>
      )}
      <div className="grid gap-3 sm:flex sm:items-center">
        <div className="flex items-center gap-3 sm:flex-1">
          <button
            type="button"
            onClick={navigatePrev}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
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
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
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
          <PremiumCardContent className="flex h-48 flex-col items-center justify-center p-6 text-center sm:h-64">
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
        <EmptyState
          icon={ReceiptText}
          title="Tu historia financiera empieza acá."
          description="Importá un resumen o agregá tu primer movimiento para que la app empiece a darte contexto."
          actions={[
            { label: "Smart Import", href: "/smart-import", primary: true },
            { label: "Agregar movimiento", href: "/transactions?new=1" },
          ]}
        />
      </>
    );
  }

  const { metrics, expensesByCategory, expenseCategoryDetails, latestTransactions, alerts, insights } = summary;
  const selectedMonth = `${year}-${String(month).padStart(2, "0")}`;
  const selectedExpenseCategoryId =
    selectedExpenseCategoryPreference &&
    expensesByCategory.some((cat) => cat.id === selectedExpenseCategoryPreference)
      ? selectedExpenseCategoryPreference
      : null;
  const selectedExpenseCategory =
    expenseCategoryDetails.find((cat) => cat.id === selectedExpenseCategoryId) ?? undefined;
  const usdBalance = metrics.accountBalances.find((b) => b.currency === "USD");

  function handleExpenseCategorySelect(categoryId: string) {
    setSelectedExpenseCategoryPreference((current) => (current === categoryId ? null : categoryId));
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

      {/* 1. Hero */}
      <DashboardHero metrics={metrics} year={year} month={month} usdBalance={usdBalance} />

      <GettingStartedCard activation={summary.activation} />
      <ContextualEntryPoints entryPoints={summary.awareness.entryPoints} />

      {/* Ambient signal */}
      {ambientHint && <AmbientSignal text={ambientHint} celebratory={isCelebratoryMonth} />}

      {/* 2. Financial Copilot */}
      <FinancialAiAnalysisCard month={selectedMonth} />

      {/* Pulso semanal — solo mes actual */}
      {isCurrentMonth && <WeeklyReflectionCard />}

      {/* Activity preview */}
      <ActivityPreview />

      {/* 3. Métricas del mes */}
      <MetricStrip
        items={[
          { label: "Ingresos", value: formatMoney(metrics.income), tone: incomeInsight.cardTone, href: "/transactions?type=INCOME" },
          { label: "Gastos", value: formatMoney(metrics.expenses), tone: expensesInsight.cardTone, href: "/transactions?type=EXPENSE" },
          { label: "Reservado", value: formatMoney(metrics.remainingReservedBudget), tone: reservedInsight.cardTone, href: "/budgets" },
          { label: "Obligaciones", value: formatMoney(metrics.upcomingObligations), tone: obligationsInsight.cardTone, href: "/recurring" },
        ]}
      />
      <FinancialHealthStrip metrics={metrics} />

      {/* 4. Distribución + tendencia — colapsable */}
      <motion.section
        variants={shouldReduceMotion ? undefined : sectionReveal}
        initial={shouldReduceMotion ? false : "hidden"}
        animate={shouldReduceMotion ? false : "visible"}
        transition={{ delay: 0.08 }}
        className="mx-auto mb-5 w-full sm:mb-8"
      >
        <SectionCollapseButton
          title="Distribución"
          summary={
            <SensitiveText text={`${metrics.fixedToIncomeRatio}% en fijos · ${formatMoney(metrics.expenses)} gastados`} />
          }
          expanded={sectionDistribucion.expanded}
          onToggle={() => {
            if (!sectionDistribucion.expanded) trackProductEvent("dashboard_section_expanded", { section: "distribucion" }, "dashboard");
            sectionDistribucion.toggle();
          }}
        />
        {sectionDistribucion.expanded && (
          <div className="grid gap-5 lg:grid-cols-2">
            <ExpenseTypeBreakdown
              expensesByType={metrics.expensesByType}
              total={metrics.expenses}
              income={metrics.income}
              fixedToIncomeRatio={metrics.fixedToIncomeRatio}
            />
            <MonthProjection metrics={metrics} />
          </div>
        )}
      </motion.section>

      {/* 5. Mapa de consumo + señales — colapsable */}
      <motion.section
        variants={shouldReduceMotion ? undefined : sectionReveal}
        initial={shouldReduceMotion ? false : "hidden"}
        animate={shouldReduceMotion ? false : "visible"}
        transition={{ delay: 0.14 }}
        className="mx-auto mb-5 w-full sm:mb-8"
      >
        <SectionCollapseButton
          title="Mapa de consumo"
          summary={`${expensesByCategory.length} categorías`}
          expanded={sectionMapa.expanded}
          onToggle={() => {
            if (!sectionMapa.expanded) trackProductEvent("dashboard_section_expanded", { section: "mapa" }, "dashboard");
            sectionMapa.toggle();
          }}
        />
        {sectionMapa.expanded && (
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
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
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Ahorro est.</p>
                    <p className="mt-2 text-lg font-bold tabular-nums text-emerald-400">
                      <SensitiveAmount value={formatMoney(metrics.estimatedSavings)} />
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">este mes →</p>
                  </PremiumCard>
                </Link>
                <Link href="/debts" className="block min-w-0">
                  <PremiumCard interactive className="p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Deuda total</p>
                    <p className="mt-2 text-lg font-bold tabular-nums text-muted-foreground">
                      <SensitiveAmount value={formatMoney(metrics.totalOutstandingDebt)} />
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">ver deudas →</p>
                  </PremiumCard>
                </Link>
              </div>
            </div>
          </div>
        )}
      </motion.section>

      {/* 6. Movimientos recientes — colapsable */}
      <motion.div
        variants={shouldReduceMotion ? undefined : sectionReveal}
        initial={shouldReduceMotion ? false : "hidden"}
        animate={shouldReduceMotion ? false : "visible"}
        transition={{ delay: 0.2 }}
      >
        <SectionCollapseButton
          title="Movimientos recientes"
          summary={`${latestTransactions.length} movimiento${latestTransactions.length !== 1 ? "s" : ""}`}
          expanded={sectionMovimientos.expanded}
          onToggle={() => {
            if (!sectionMovimientos.expanded) trackProductEvent("dashboard_section_expanded", { section: "movimientos" }, "dashboard");
            sectionMovimientos.toggle();
          }}
        />
        {sectionMovimientos.expanded && (
          <PremiumCard>
            <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
              <h3 className="text-sm font-semibold text-foreground">Movimientos recientes</h3>
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
              >
                <Link href="/transactions">Ver todas →</Link>
              </Button>
            </div>
            <PremiumCardContent>
              <RecentTransactions transactions={latestTransactions} />
            </PremiumCardContent>
          </PremiumCard>
        )}
      </motion.div>
    </div>
  );
}
