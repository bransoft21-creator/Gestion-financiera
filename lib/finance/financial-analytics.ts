/**
 * Layer 1 — Local financial analytics (no AI).
 * Pure deterministic functions: no side effects, no DB access.
 */

import type { Prisma } from "@prisma/client";

export type TxForAnalysis = Prisma.TransactionGetPayload<{
  include: {
    category: { select: { name: true; type: true } };
    account: { select: { name: true; type: true } };
  };
}>;

export interface WeeklyMetrics {
  totalExpenses: number;
  totalIncome: number;
  balance: number;
  savingsRate: number;       // 0–100
  transactionCount: number;
  avgExpense: number;
  topCategory: { name: string; total: number; pct: number } | null;
  weekendExpenses: number;
  weekendPct: number;        // 0–100
  categoryBreakdown: Array<{ name: string; total: number; count: number; pct: number }>;
  creditPct: number;         // % of expenses paid with credit card
  hasData: boolean;
}

export interface WeeklyComparison {
  available: boolean;
  expensesPct: number | null;
  incomePct: number | null;
  weekendPct: number | null;
  topCategoryChange: { name: string; pct: number | null } | null;
}

const WEEKEND_DAYS = new Set([0, 6]); // 0 = Sunday, 6 = Saturday

/** Returns ISO week key prefixed for namespacing: "weekly:2025-W20" */
export function getISOWeekKey(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `weekly:${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Returns the Mon 00:00 → Sun 23:59 window for the week containing `date` */
export function getWeekWindow(date: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const offsetToMonday = day === 0 ? -6 : 1 - day;

  const start = new Date(d);
  start.setDate(d.getDate() + offsetToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/** Computes all weekly metrics from a set of transactions (any status/type mix) */
export function computeWeeklyMetrics(txs: TxForAnalysis[]): WeeklyMetrics {
  const expenses = txs.filter((t) => t.type === "EXPENSE" && t.status === "CONFIRMED");
  const income = txs.filter((t) => t.type === "INCOME" && t.status === "CONFIRMED");

  const totalExpenses = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const totalIncome = income.reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.max(0, balance / totalIncome) * 100 : 0;

  const weekendExpenses = expenses
    .filter((t) => WEEKEND_DAYS.has(new Date(t.occurredAt).getDay()))
    .reduce((s, t) => s + Number(t.amount), 0);
  const weekendPct = totalExpenses > 0 ? (weekendExpenses / totalExpenses) * 100 : 0;

  // Category breakdown (expenses only)
  const catMap = new Map<string, { total: number; count: number }>();
  for (const t of expenses) {
    const name = t.category?.name ?? "Sin categoría";
    const prev = catMap.get(name) ?? { total: 0, count: 0 };
    catMap.set(name, { total: prev.total + Number(t.amount), count: prev.count + 1 });
  }
  const categoryBreakdown = Array.from(catMap.entries())
    .map(([name, { total, count }]) => ({
      name,
      total,
      count,
      pct: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const creditTotal = expenses
    .filter((t) => t.paymentMethod === "CREDIT")
    .reduce((s, t) => s + Number(t.amount), 0);
  const creditPct = totalExpenses > 0 ? (creditTotal / totalExpenses) * 100 : 0;

  return {
    totalExpenses,
    totalIncome,
    balance,
    savingsRate,
    transactionCount: expenses.length,
    avgExpense: expenses.length > 0 ? totalExpenses / expenses.length : 0,
    topCategory: categoryBreakdown[0]
      ? { name: categoryBreakdown[0].name, total: categoryBreakdown[0].total, pct: categoryBreakdown[0].pct }
      : null,
    weekendExpenses,
    weekendPct,
    categoryBreakdown,
    creditPct,
    hasData: txs.length > 0,
  };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function computeWeeklyComparison(
  current: WeeklyMetrics,
  previous: WeeklyMetrics,
): WeeklyComparison {
  if (!previous.hasData || !current.hasData) {
    return {
      available: false,
      expensesPct: null,
      incomePct: null,
      weekendPct: null,
      topCategoryChange: null,
    };
  }

  let topCategoryChange: WeeklyComparison["topCategoryChange"] = null;
  if (current.topCategory) {
    const prev = previous.categoryBreakdown.find((c) => c.name === current.topCategory!.name);
    topCategoryChange = {
      name: current.topCategory.name,
      pct: prev ? pctChange(current.topCategory.total, prev.total) : null,
    };
  }

  return {
    available: true,
    expensesPct: pctChange(current.totalExpenses, previous.totalExpenses),
    incomePct: pctChange(current.totalIncome, previous.totalIncome),
    weekendPct: pctChange(current.weekendExpenses, previous.weekendExpenses),
    topCategoryChange,
  };
}
