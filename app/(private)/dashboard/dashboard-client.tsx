"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  HandCoins,
  ReceiptText,
} from "lucide-react";
import { SensitiveAmount, SensitiveText } from "@/components/app/sensitive-amount";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { FinancialAiAnalysisCard } from "@/components/dashboard/financial-ai-analysis-card";
import { MonthlyCloseCard } from "@/components/dashboard/monthly-close-card";
import {
  PremiumCard,
  PremiumCardContent,
} from "@/components/ui-v2/premium-card";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { MonthlySignals } from "@/components/dashboard/monthly-signals";
import { ExpenseTypeBreakdown } from "@/components/dashboard/expense-type-breakdown";
import { MonthProjection } from "@/components/dashboard/month-projection";
import { ExpenseCategoryExplorer } from "@/components/dashboard/expense-category-explorer";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { ActivityPreview } from "@/components/dashboard/activity-preview";
import { GettingStartedCard } from "@/components/dashboard/getting-started-card";
import { ContextualEntryPoints } from "@/components/dashboard/contextual-entry-points";
import { HouseholdWidget } from "@/components/dashboard/household-widget";
import { ContextualEducationCard } from "@/components/education/contextual-education-card";
import { useSectionCollapse } from "@/hooks/use-section-collapse";
import { getDashboardEducation } from "@/lib/finance/contextual-education";
import { trackProductEvent } from "@/lib/observability/client";
import {
  formatMoney,
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


/* ── Main component ──────────────────────────────────────────────────────── */

export function DashboardClient() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { data: summary = null, isLoading, error: queryError } = useDashboardSummary(year, month);
  const error = queryError ? queryError.message : null;
  const [selectedExpenseCategoryPreference, setSelectedExpenseCategoryPreference] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const sectionDistribucion = useSectionCollapse("distribucion", false);
  const sectionMapa = useSectionCollapse("mapa", false);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  useEffect(() => {
    if (!summary || !isCurrentMonth) return;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    void fetch("/api/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: prevYear, month: prevMonth }),
    });
  }, [summary, isCurrentMonth, month, year]);

  function navigatePrev() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }

  function navigateNext() {
    if (isCurrentMonth) return;
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <PremiumCard>
        <PremiumCardContent className="flex h-48 flex-col items-center justify-center p-6 text-center sm:h-64">
          <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">No pudimos traer tu información</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </PremiumCardContent>
      </PremiumCard>
    );
  }

  if (!summary) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="Tu historia financiera empieza acá."
        description="Importá un resumen o agregá tu primer movimiento para que la app empiece a darte contexto."
        actions={[
          { label: "Smart Import", href: "/smart-import", primary: true },
          { label: "Agregar movimiento", href: "/transactions?new=1" },
        ]}
      />
    );
  }

  const { metrics, expensesByCategory, expenseCategoryDetails, latestTransactions, alerts, insights, interpersonalPosition } = summary;
  const selectedMonth = `${year}-${String(month).padStart(2, "0")}`;
  const selectedExpenseCategoryId =
    selectedExpenseCategoryPreference &&
    expensesByCategory.some((cat) => cat.id === selectedExpenseCategoryPreference)
      ? selectedExpenseCategoryPreference
      : null;
  const selectedExpenseCategory =
    expenseCategoryDetails.find((cat) => cat.id === selectedExpenseCategoryId) ?? undefined;
  // accountBalances reflects current state, not historical — only show non-primary balances
  // on the current month to avoid confusing past-month views with present-day account data.
  const usdBalance = isCurrentMonth
    ? metrics.accountBalances.find((b) => b.currency === "USD" && b.currency !== metrics.currency)
    : undefined;

  function handleExpenseCategorySelect(categoryId: string) {
    setSelectedExpenseCategoryPreference((current) => (current === categoryId ? null : categoryId));
  }

  const dashboardEducation = getDashboardEducation(metrics);

  return (
    <div className="fade-in">
      {/* 1. Hero */}
      <DashboardHero
        metrics={metrics}
        year={year}
        month={month}
        usdBalance={usdBalance}
        onPrevMonth={navigatePrev}
        onNextMonth={navigateNext}
        isCurrentMonth={isCurrentMonth}
      />

      <GettingStartedCard activation={summary.activation} />

      {/* Cierre de mes anterior — solo mes actual, primeros 10 días */}
      {isCurrentMonth && <MonthlyCloseCard />}

      {/* Hogar — widget no-intrusivo, solo informacional */}
      {isCurrentMonth && <HouseholdWidget />}

      {/* Dinero en tránsito — solo si hay acuerdos activos */}
      {(interpersonalPosition.toReceive > 0 || interpersonalPosition.toPay > 0) && (
        <Link href="/agreements" className="block mb-4">
          <PremiumCard interactive className="overflow-hidden">
            <PremiumCardContent className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <HandCoins className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Dinero en tránsito
                    {interpersonalPosition.overdueCount > 0 && (
                      <span className="ml-1.5 text-destructive normal-case">
                        · {interpersonalPosition.overdueCount} vencido{interpersonalPosition.overdueCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {interpersonalPosition.toReceive > 0 && (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                        <SensitiveAmount value={formatMoney(interpersonalPosition.toReceive, interpersonalPosition.currency)} />
                      </div>
                    )}
                    {interpersonalPosition.toReceive > 0 && interpersonalPosition.toPay > 0 && (
                      <span className="text-muted-foreground text-xs">·</span>
                    )}
                    {interpersonalPosition.toPay > 0 && (
                      <div className="flex items-center gap-1 text-amber-600">
                        <ArrowDownLeft className="h-3.5 w-3.5 shrink-0" />
                        <SensitiveAmount value={formatMoney(interpersonalPosition.toPay, interpersonalPosition.currency)} />
                      </div>
                    )}
                    {interpersonalPosition.toPay > 0 && (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/[0.07] px-2 py-0.5 text-[10px] font-medium text-amber-600">
                        descontado del disponible
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </PremiumCardContent>
          </PremiumCard>
        </Link>
      )}

      {/* 2. Financial Copilot */}
      <FinancialAiAnalysisCard month={selectedMonth} />

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
            <SensitiveText text={`${metrics.fixedToIncomeRatio}% en fijos · ${formatMoney(metrics.expenses, metrics.currency)} gastados`} />
          }
          expanded={sectionDistribucion.expanded}
          onToggle={() => {
            if (!sectionDistribucion.expanded) trackProductEvent("dashboard_section_expanded", { section: "distribucion" }, "dashboard");
            sectionDistribucion.toggle();
          }}
        />
        {sectionDistribucion.expanded && (
          <div className="space-y-5">
            <ContextualEducationCard
              item={dashboardEducation}
              surface="dashboard"
              compact
            />
            <div className="grid gap-5 lg:grid-cols-2">
              <ExpenseTypeBreakdown
                expensesByType={metrics.expensesByType}
                total={metrics.expenses}
                income={metrics.income}
                fixedToIncomeRatio={metrics.fixedToIncomeRatio}
                year={year}
                month={month}
                currency={metrics.currency}
              />
              <MonthProjection metrics={metrics} />
            </div>
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
              currency={metrics.currency}
              onSelectCategory={handleExpenseCategorySelect}
            />
            <div className="flex flex-col gap-4">
              <MonthlySignals insights={insights} alerts={alerts} />
              <div className="grid grid-cols-2 gap-3">
                <Link href="/goals" className="block min-w-0">
                  <PremiumCard interactive className="p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Ahorro est.</p>
                    <p className="mt-2 text-lg font-bold tabular-nums text-emerald-400">
                      <SensitiveAmount value={formatMoney(metrics.estimatedSavings, metrics.currency)} />
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">este mes →</p>
                  </PremiumCard>
                </Link>
                <Link href="/debts" className="block min-w-0">
                  <PremiumCard interactive className="p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Pasivo formal</p>
                    <p className="mt-2 text-lg font-bold tabular-nums text-muted-foreground">
                      <SensitiveAmount value={formatMoney(metrics.totalOutstandingDebt, metrics.currency)} />
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">ver créditos →</p>
                  </PremiumCard>
                </Link>
              </div>
            </div>
          </div>
        )}
      </motion.section>

      {/* 6. Movimientos recientes */}
      <motion.div
        variants={shouldReduceMotion ? undefined : sectionReveal}
        initial={shouldReduceMotion ? false : "hidden"}
        animate={shouldReduceMotion ? false : "visible"}
        transition={{ delay: 0.2 }}
      >
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
      </motion.div>

      <ContextualEntryPoints entryPoints={summary.awareness.entryPoints} />
      <ActivityPreview />
    </div>
  );
}
