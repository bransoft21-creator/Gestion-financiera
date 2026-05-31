import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPrimaryHousehold } from "@/server/services/workspace";
import { prisma } from "@/lib/prisma";
import { ActivityTone, ActivityType, TransactionOrigin } from "@prisma/client";
import { upsertActivity } from "@/server/services/activity";
import {
  getWeekWindow,
  getISOWeekKey,
  computeWeeklyMetrics,
  computeWeeklyComparison,
} from "@/lib/finance/financial-analytics";
import { generateWeeklySignals } from "@/lib/finance/financial-signals";
import { buildWeekLabel } from "@/lib/finance/reflection-cache";
import type { SignalSeverity } from "@/lib/finance/financial-signals";

export const runtime = "nodejs";

export interface WeeklyPulseData {
  weekLabel: string;
  weekKey: string;
  currency: string;
  mixedCurrencies: boolean;
  ignoredCurrencies: string[];
  hasData: boolean;
  overallTone: SignalSeverity;
  totalExpenses: number;
  transactionCount: number;
  expensesChange: number | null;
  topCategory: { name: string; pct: number } | null;
  signals: Array<{ id: string; label: string; severity: SignalSeverity }>;
  /** Days elapsed in the current ISO week (1=Mon … 7=Sun). Used to suppress early-week comparisons. */
  daysElapsed: number;
}

function deriveOverallTone(
  signals: Array<{ severity: SignalSeverity }>,
  expensesChange: number | null,
): SignalSeverity {
  if (signals.some((s) => s.severity === "warning")) return "warning";
  if (signals.some((s) => s.severity === "positive")) return "positive";
  if (expensesChange !== null && expensesChange < -10) return "positive";
  return "neutral";
}

export async function GET() {
  try {
    const { userProfile } = await getCurrentUser();
    const household = await getPrimaryHousehold(userProfile.id);

    const now = new Date();
    const currentWindow = getWeekWindow(now);
    const prevWeekDate = new Date(currentWindow.start);
    prevWeekDate.setDate(prevWeekDate.getDate() - 1);
    const prevWindow = getWeekWindow(prevWeekDate);

    const weekKey = getISOWeekKey(now);
    const weekLabel = buildWeekLabel(currentWindow.start, currentWindow.end);
    const dayOfWeek = now.getDay(); // 0=Sun … 6=Sat
    const daysElapsed = dayOfWeek === 0 ? 7 : dayOfWeek;

    const txQuery = (start: Date, end: Date) =>
      prisma.transaction.findMany({
        where: {
          householdId: household.id,
          occurredAt: { gte: start, lte: end },
          status: "CONFIRMED",
          type: { in: ["INCOME", "EXPENSE", "CARD_PAYMENT"] },
          deletedAt: null,
          NOT: [
            { origin: TransactionOrigin.CARD_SUMMARY },
            { type: "EXPENSE", statementTransactions: { some: { deletedAt: null } } },
          ],
        },
        include: {
          category: { select: { name: true, type: true } },
          account: { select: { name: true, type: true } },
        },
      });

    const [currentTxs, previousTxs] = await Promise.all([
      txQuery(currentWindow.start, currentWindow.end),
      txQuery(prevWindow.start, prevWindow.end),
    ]);

    const currency = household.defaultCurrency;
    const currentMetrics = computeWeeklyMetrics(currentTxs, currency);
    const previousMetrics = computeWeeklyMetrics(previousTxs, currency);

    if (!currentMetrics.hasData) {
      return ok<WeeklyPulseData>({
        weekLabel,
        weekKey,
        currency,
        mixedCurrencies: currentMetrics.mixedCurrencies,
        ignoredCurrencies: currentMetrics.ignoredCurrencies,
        hasData: false,
        overallTone: "neutral",
        totalExpenses: 0,
        transactionCount: 0,
        expensesChange: null,
        topCategory: null,
        signals: [],
        daysElapsed,
      });
    }

    const comparison = computeWeeklyComparison(currentMetrics, previousMetrics);
    // Take only the 2 most relevant signals for the pulse (warnings first)
    const allSignals = generateWeeklySignals(currentMetrics, comparison);
    const signals = allSignals.slice(0, 2);

    const expensesChange = comparison.available ? comparison.expensesPct : null;
    const overallTone = deriveOverallTone(signals, expensesChange);
    const activityTitle =
      overallTone === "warning"
        ? "Esta semana tiene movimientos para revisar"
        : overallTone === "positive"
          ? "Buena semana financiera"
          : "Así fue tu semana";
    const activityBody = signals[0]?.label ?? `${currentMetrics.transactionCount} movimientos registrados esta semana.`;
    await upsertActivity({
      userId: userProfile.id,
      type: ActivityType.INSIGHT,
      source: "weekly-pulse",
      tone: overallTone === "warning"
        ? ActivityTone.warning
        : overallTone === "positive"
          ? ActivityTone.positive
          : ActivityTone.neutral,
      priority: overallTone === "warning" ? 1 : 0,
      title: activityTitle,
      body: activityBody,
      metadata: {
        tone: overallTone,
        signalCount: signals.length,
      },
      dedupeKey: `weekly-pulse-${weekKey}`,
      periodKey: weekKey,
      actionLabel: "Ver dashboard",
      actionLink: "/dashboard",
    });

    return ok<WeeklyPulseData>({
      weekLabel,
      weekKey,
      currency,
      mixedCurrencies: currentMetrics.mixedCurrencies,
      ignoredCurrencies: currentMetrics.ignoredCurrencies,
      hasData: true,
      overallTone,
      totalExpenses: currentMetrics.totalExpenses,
      transactionCount: currentMetrics.transactionCount,
      expensesChange,
      topCategory: currentMetrics.topCategory
        ? { name: currentMetrics.topCategory.name, pct: currentMetrics.topCategory.pct }
        : null,
      signals,
      daysElapsed,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
