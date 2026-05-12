/**
 * Orchestrator for the Weekly Financial Reflection feature.
 * Coordinates: analytics → signals → cache check → AI → cache write.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getWeekWindow,
  getISOWeekKey,
  computeWeeklyMetrics,
  computeWeeklyComparison,
} from "@/lib/finance/financial-analytics";
import { generateWeeklySignals } from "@/lib/finance/financial-signals";
import { buildWeeklyInputHash, buildWeekLabel } from "@/lib/finance/reflection-cache";
import {
  generateWeeklyReflection,
  type ReflectionResult,
} from "@/lib/finance/ai-financial-reflection";

export interface WeeklyReflectionData {
  insights: ReflectionResult["insights"];
  weekKey: string;
  weekLabel: string;
  cached: boolean;
  hasData: boolean;
}

export async function getOrGenerateWeeklyReflection(params: {
  userProfileId: string;
  householdId: string;
  forceRegenerate?: boolean;
}): Promise<WeeklyReflectionData> {
  const { userProfileId, householdId, forceRegenerate = false } = params;
  const now = new Date();

  const currentWindow = getWeekWindow(now);

  // Previous week: Mon of the week before current
  const prevWeekDate = new Date(currentWindow.start);
  prevWeekDate.setDate(prevWeekDate.getDate() - 1);
  const prevWindow = getWeekWindow(prevWeekDate);

  const weekKey = getISOWeekKey(now);
  const weekLabel = buildWeekLabel(currentWindow.start, currentWindow.end);

  const txQuery = (start: Date, end: Date) =>
    prisma.transaction.findMany({
      where: {
        householdId,
        occurredAt: { gte: start, lte: end },
        status: "CONFIRMED",
        type: { in: ["INCOME", "EXPENSE"] },
        deletedAt: null,
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

  // Layer 1 — analytics
  const currentMetrics = computeWeeklyMetrics(currentTxs);
  const previousMetrics = computeWeeklyMetrics(previousTxs);

  if (!currentMetrics.hasData) {
    return { insights: [], weekKey, weekLabel, cached: false, hasData: false };
  }

  const comparison = computeWeeklyComparison(currentMetrics, previousMetrics);

  // Layer 2 — signals
  const signals = generateWeeklySignals(currentMetrics, comparison);

  // Cache check
  const inputHash = buildWeeklyInputHash(currentMetrics, signals);

  if (!forceRegenerate) {
    const cached = await prisma.aiFinancialAnalysis.findUnique({
      where: { userId_month: { userId: userProfileId, month: weekKey } },
      select: { inputHash: true, result: true },
    });

    if (cached && cached.inputHash === inputHash) {
      const result = cached.result as unknown as ReflectionResult;
      return {
        insights: result.insights ?? [],
        weekKey,
        weekLabel,
        cached: true,
        hasData: true,
      };
    }
  }

  // Layer 3 — AI narrative
  const reflectionResult = await generateWeeklyReflection({
    weekLabel,
    totalExpenses: currentMetrics.totalExpenses,
    totalIncome: currentMetrics.totalIncome,
    savingsRate: currentMetrics.savingsRate,
    topCategory: currentMetrics.topCategory?.name ?? null,
    weekendPct: currentMetrics.weekendPct,
    expensesChange: comparison.available ? comparison.expensesPct : null,
    signals: signals.map((s) => ({ label: s.label, severity: s.severity })),
  });

  // Persist to cache
  await prisma.aiFinancialAnalysis.upsert({
    where: { userId_month: { userId: userProfileId, month: weekKey } },
    create: {
      userId: userProfileId,
      month: weekKey,
      inputHash,
      result: reflectionResult as unknown as Prisma.InputJsonValue,
    },
    update: {
      inputHash,
      result: reflectionResult as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    insights: reflectionResult.insights,
    weekKey,
    weekLabel,
    cached: false,
    hasData: true,
  };
}

/** Returns cached reflection for current week (no AI call, no regeneration) */
export async function getSavedWeeklyReflection(params: {
  userProfileId: string;
}): Promise<WeeklyReflectionData | null> {
  const now = new Date();
  const weekKey = getISOWeekKey(now);
  const currentWindow = getWeekWindow(now);
  const weekLabel = buildWeekLabel(currentWindow.start, currentWindow.end);

  const saved = await prisma.aiFinancialAnalysis.findUnique({
    where: { userId_month: { userId: params.userProfileId, month: weekKey } },
    select: { result: true },
  });

  if (!saved) return null;

  const result = saved.result as unknown as ReflectionResult;
  return {
    insights: result.insights ?? [],
    weekKey,
    weekLabel,
    cached: true,
    hasData: (result.insights ?? []).length > 0,
  };
}
