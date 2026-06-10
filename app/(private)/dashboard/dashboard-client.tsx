"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
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
import { GoalsWidget } from "@/components/dashboard/goals-widget";
import { NetWorthWidget } from "@/components/dashboard/net-worth-widget";
import { ContextualEntryPoints } from "@/components/dashboard/contextual-entry-points";
import { HouseholdWidget } from "@/components/dashboard/household-widget";
import { ContextualEducationCard } from "@/components/education/contextual-education-card";
import { getDashboardEducation } from "@/lib/finance/contextual-education";
import {
  formatMoney,
  sectionReveal,
} from "./utils";
import type { DashboardSummary } from "./types";
import { getPeriodStatus } from "@/lib/period-status";

const ReportsClient = dynamic(
  () => import("@/app/(private)/reports/reports-client").then((m) => ({ default: m.ReportsClient })),
  { ssr: false },
);

type DashboardTab = "month" | "history";

/* ── Main component ──────────────────────────────────────────────────────── */

export function DashboardClient({ householdId }: { householdId: string }) {
  const now = new Date();
  const [activeTab, setActiveTab] = useState<DashboardTab>("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { data: summary = null, isLoading, error: queryError } = useDashboardSummary(year, month);
  const error = queryError ? queryError.message : null;
  const [selectedExpenseCategoryPreference, setSelectedExpenseCategoryPreference] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const periodStatus = getPeriodStatus(year, month);

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
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-2xl border border-border bg-muted/40 p-1">
        {([
          { id: "month", label: "Este mes" },
          { id: "history", label: "Histórico" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-xl px-3 py-1.5 text-[13px] font-semibold transition-all duration-150 ${
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "history" ? (
        <ReportsClient householdId={householdId} />
      ) : (
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
        periodStatus={periodStatus}
      />

      <GettingStartedCard activation={summary.activation} />

      {/* Cierre de mes anterior — solo mes actual, primeros 10 días */}
      {isCurrentMonth && <MonthlyCloseCard />}

      {/* Metas activas con asignación mensual */}
      {isCurrentMonth && <GoalsWidget householdId={householdId} />}

      {/* Patrimonio neto — snapshot de cuentas y pasivos */}
      {isCurrentMonth && <NetWorthWidget householdId={householdId} />}

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
      <FinancialAiAnalysisCard month={selectedMonth} isCurrentMonth={isCurrentMonth} />

      {/* 3. Distribución y consumo */}
      <motion.div
        variants={shouldReduceMotion ? undefined : sectionReveal}
        initial={shouldReduceMotion ? false : "hidden"}
        animate={shouldReduceMotion ? false : "visible"}
        transition={{ delay: 0.08 }}
        className="mb-5 space-y-5 sm:mb-8"
      >
        <ContextualEducationCard item={dashboardEducation} surface="dashboard" compact />
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
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <ExpenseCategoryExplorer
            expensesByCategory={expensesByCategory}
            selectedExpenseCategory={selectedExpenseCategory}
            selectedExpenseCategoryId={selectedExpenseCategoryId}
            totalExpenses={metrics.expenses}
            currency={metrics.currency}
            onSelectCategory={handleExpenseCategorySelect}
          />
          <MonthlySignals insights={insights} alerts={alerts} />
        </div>
      </motion.div>

      {/* 4. Movimientos recientes */}
      <motion.div
        variants={shouldReduceMotion ? undefined : sectionReveal}
        initial={shouldReduceMotion ? false : "hidden"}
        animate={shouldReduceMotion ? false : "visible"}
        transition={{ delay: 0.14 }}
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

      <div className="mt-5">
        <ContextualEntryPoints entryPoints={summary.awareness.entryPoints} />
      </div>
      <div className="mt-5">
        <ActivityPreview />
      </div>
    </div>
      )}
    </div>
  );
}
