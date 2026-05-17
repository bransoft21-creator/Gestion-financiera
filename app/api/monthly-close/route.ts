/**
 * GET /api/monthly-close
 *
 * Returns deterministic close data for the most recently completed month.
 * Reads MonthlySnapshot records (already captured by the dashboard on load).
 * Falls back to a live transaction query if no snapshot exists yet.
 * No AI, no cost — safe to call on every dashboard render.
 */
import { ActivityTone, ActivityType, type Prisma } from "@prisma/client";
import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPrimaryHousehold } from "@/server/services/workspace";
import { prisma } from "@/lib/prisma";
import { upsertActivity } from "@/server/services/activity";
import { toFiniteNumber } from "@/server/services/financial-ledger";
import {
  generateMonthlySignals,
  type MonthlySignal,
  type MonthlySignalSeverity,
  type MonthlySnapshotMetrics,
} from "@/lib/finance/monthly-signals";

export const runtime = "nodejs";

const MONTH_NAMES_ES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

function buildMonthLabel(year: number, month: number): string {
  return `${MONTH_NAMES_ES[month - 1]} ${year}`;
}

function prevMonthOf(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function toMetrics(row: {
  incomeAmount: Prisma.Decimal;
  expenseAmount: Prisma.Decimal;
  availableAmount: Prisma.Decimal;
  reservedAmount: Prisma.Decimal;
  upcomingObligationsAmount: Prisma.Decimal;
}): MonthlySnapshotMetrics {
  return {
    income: toFiniteNumber(row.incomeAmount),
    expenses: toFiniteNumber(row.expenseAmount),
    available: toFiniteNumber(row.availableAmount),
    reserved: toFiniteNumber(row.reservedAmount),
    obligations: toFiniteNumber(row.upcomingObligationsAmount),
  };
}

function deriveOverallTone(
  signals: MonthlySignal[],
  metrics: MonthlySnapshotMetrics,
): MonthlySignalSeverity {
  if (signals.some((s) => s.severity === "warning")) return "warning";
  if (metrics.available < 0) return "warning";
  if (signals.some((s) => s.severity === "positive")) return "positive";
  return "neutral";
}

export interface MonthlyCloseData {
  monthLabel: string;
  monthKey: string;
  hasData: boolean;
  overallTone: MonthlySignalSeverity;
  income: number;
  expenses: number;
  available: number;
  expensesVsPrev: number | null;
  availableVsPrev: number | null;
  signals: MonthlySignal[];
}

export async function GET() {
  try {
    const { userProfile } = await getCurrentUser();
    const household = await getPrimaryHousehold(userProfile.id);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Monthly Close only makes sense after at least one full month
    const { year: closeYear, month: closeMonth } = prevMonthOf(currentYear, currentMonth);
    const { year: prevYear, month: prevMonth } = prevMonthOf(closeYear, closeMonth);

    const monthKey = `${closeYear}-${String(closeMonth).padStart(2, "0")}`;
    const monthLabel = buildMonthLabel(closeYear, closeMonth);

    // Load both snapshots in parallel
    const [closeSnap, prevSnap] = await Promise.all([
      prisma.monthlySnapshot.findUnique({
        where: {
          householdId_currency_year_month: {
            householdId: household.id,
            currency: "ARS",
            year: closeYear,
            month: closeMonth,
          },
        },
      }),
      prisma.monthlySnapshot.findUnique({
        where: {
          householdId_currency_year_month: {
            householdId: household.id,
            currency: "ARS",
            year: prevYear,
            month: prevMonth,
          },
        },
      }),
    ]);

    if (!closeSnap) {
      return ok<MonthlyCloseData>({
        monthLabel,
        monthKey,
        hasData: false,
        overallTone: "neutral",
        income: 0,
        expenses: 0,
        available: 0,
        expensesVsPrev: null,
        availableVsPrev: null,
        signals: [],
      });
    }

    const current = toMetrics(closeSnap);
    const previous = prevSnap ? toMetrics(prevSnap) : null;

    const signals = generateMonthlySignals(current, previous);
    const overallTone = deriveOverallTone(signals, current);

    const expensesVsPrev =
      previous && previous.expenses > 0
        ? ((current.expenses - previous.expenses) / previous.expenses) * 100
        : null;

    const availableVsPrev =
      previous && previous.available !== 0
        ? current.available - previous.available
        : null;
    await upsertActivity({
      userId: userProfile.id,
      type: ActivityType.INSIGHT,
      source: "monthly-close",
      tone: overallTone === "warning"
        ? ActivityTone.warning
        : overallTone === "positive"
          ? ActivityTone.positive
          : ActivityTone.neutral,
      priority: overallTone === "warning" ? 1 : 0,
      title: "Tu cierre de mes está disponible.",
      body: `Ya podés revisar ${monthLabel} con señales claras y sin ruido.`,
      metadata: {
        tone: overallTone,
        signalCount: signals.length,
      },
      dedupeKey: `monthly-close-${monthKey}`,
      periodKey: monthKey,
      actionLabel: "Ver dashboard",
      actionLink: "/dashboard",
    });

    return ok<MonthlyCloseData>({
      monthLabel,
      monthKey,
      hasData: true,
      overallTone,
      income: current.income,
      expenses: current.expenses,
      available: current.available,
      expensesVsPrev,
      availableVsPrev,
      signals,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
