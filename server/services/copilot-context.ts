import { DebtStatus, TransactionStatus } from "@prisma/client";
import { argentinaMonthRangeUtc } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { assertHouseholdAccess } from "./households";
// buildCompactInputForMonth is not exported — we replicate the lightweight queries needed
// rather than duplicating the full analysis pipeline. The context only needs aggregates.

export type CopilotFinancialContext = {
  generatedAt: string;
  period: { current: string; previous: string };
  currency: string;
  summary: {
    income: number;
    expenses: number;
    balance: number;
    savingsRate: number;
    transactionCount: number;
  };
  comparison: {
    available: boolean;
    incomeChangePercent: number | null;
    expenseChangePercent: number | null;
    savingsRateChange: number;
    categoryChanges: Array<{
      category: string;
      currentAmount: number;
      previousAmount: number;
      changePercent: number | null;
    }>;
  };
  topCategories: Array<{
    name: string;
    total: number;
    percentage: number;
    vsLastMonth: number | null;
  }>;
  recurringExpenses: Array<{
    description: string;
    amount: number;
    currency: string;
    category: string;
  }>;
  budgets: Array<{
    category: string;
    planned: number;
    actual: number;
    remaining: number;
    status: "ok" | "warning" | "over";
  }>;
  goals: Array<{
    name: string;
    targetAmount: number;
    currentAmount: number;
    progressPercent: number;
    monthlyContribution: number;
    currency: string;
  }>;
  debts: Array<{
    name: string;
    outstanding: number;
    currency: string;
    minimumPayment: number;
  }>;
  household: {
    memberCount: number;
    hasPendingBalance: boolean;
    summaryText: string;
  };
  signals: {
    highImpactTransactions: Array<{
      description: string;
      amount: number;
      category: string;
      incomePercentage: number;
    }>;
    repeatedSmallExpenses: Array<{
      description: string;
      count: number;
      total: number;
    }>;
  };
};

export async function buildCopilotContext(
  userProfileId: string,
  householdId: string,
  month: string,
): Promise<CopilotFinancialContext> {
  await assertHouseholdAccess(userProfileId, householdId);

  const { year, monthNumber } = parseMonth(month);
  const prevMonth = getPreviousMonth(year, monthNumber);

  const [household, current, previous, goals, debts, budgets, recurring, members] =
    await Promise.all([
      prisma.household.findUniqueOrThrow({
        where: { id: householdId },
        select: { defaultCurrency: true },
      }),
      fetchMonthSummary(householdId, year, monthNumber),
      fetchMonthSummary(householdId, prevMonth.year, prevMonth.monthNumber),
      fetchGoals(householdId),
      fetchDebts(householdId),
      fetchBudgets(householdId, year, monthNumber),
      fetchRecurring(householdId),
      prisma.householdMember.count({
        where: { householdId, deletedAt: null },
      }),
    ]);

  const currency = household.defaultCurrency;
  const primaryCurrent = current.filter((t) => t.currency === currency);
  const primaryPrevious = previous.filter((t) => t.currency === currency);

  const incomeC = sumByType(primaryCurrent, ["INCOME"]);
  const expenseC = sumByType(primaryCurrent, ["EXPENSE", "CARD_PAYMENT"]);
  const incomeP = sumByType(primaryPrevious, ["INCOME"]);
  const expenseP = sumByType(primaryPrevious, ["EXPENSE", "CARD_PAYMENT"]);
  const balanceC = incomeC - expenseC;
  const balanceP = incomeP - expenseP;
  const savingsC = incomeC > 0 ? round((balanceC / incomeC) * 100) : 0;
  const savingsP = incomeP > 0 ? round((balanceP / incomeP) * 100) : 0;
  const hasPrev = primaryPrevious.length > 0;

  const categoryTotalsC = groupByCategory(primaryCurrent.filter((t) => t.type === "EXPENSE" || t.type === "CARD_PAYMENT"));
  const categoryTotalsP = groupByCategory(primaryPrevious.filter((t) => t.type === "EXPENSE" || t.type === "CARD_PAYMENT"));

  const topCategories = categoryTotalsC
    .slice(0, 8)
    .map((cat) => {
      const prevTotal = categoryTotalsP.find((c) => c.name === cat.name)?.total ?? null;
      return {
        name: cat.name,
        total: cat.total,
        percentage: expenseC > 0 ? round((cat.total / expenseC) * 100) : 0,
        vsLastMonth: prevTotal !== null && prevTotal > 0
          ? round(((cat.total - prevTotal) / prevTotal) * 100)
          : null,
      };
    });

  const categoryChanges = hasPrev
    ? buildCategoryChanges(categoryTotalsC, categoryTotalsP)
    : [];

  const budgetRows = budgets.map((b) => ({
    category: b.categoryName,
    planned: b.planned,
    actual: b.actual,
    remaining: Math.max(b.planned - b.actual, 0),
    status: (b.actual > b.planned ? "over" : b.actual / b.planned > 0.85 ? "warning" : "ok") as "ok" | "warning" | "over",
  }));

  const highImpact = primaryCurrent
    .filter((t) => (t.type === "EXPENSE" || t.type === "CARD_PAYMENT") && incomeC > 0 && t.amount / incomeC > 0.05)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((t) => ({
      description: t.description?.slice(0, 60) ?? "",
      amount: t.amount,
      category: t.categoryName ?? "Sin categoría",
      incomePercentage: round((t.amount / incomeC) * 100),
    }));

  const repeatedGroups = detectRepeated(primaryCurrent.filter((t) => t.type === "EXPENSE" || t.type === "CARD_PAYMENT"));

  return {
    generatedAt: new Date().toISOString(),
    period: {
      current: month,
      previous: `${prevMonth.year}-${String(prevMonth.monthNumber).padStart(2, "0")}`,
    },
    currency,
    summary: {
      income: incomeC,
      expenses: expenseC,
      balance: balanceC,
      savingsRate: savingsC,
      transactionCount: primaryCurrent.length,
    },
    comparison: {
      available: hasPrev,
      incomeChangePercent: hasPrev && incomeP > 0 ? round(((incomeC - incomeP) / incomeP) * 100) : null,
      expenseChangePercent: hasPrev && expenseP > 0 ? round(((expenseC - expenseP) / expenseP) * 100) : null,
      savingsRateChange: hasPrev ? round(savingsC - savingsP) : 0,
      categoryChanges,
    },
    topCategories,
    recurringExpenses: recurring.slice(0, 10),
    budgets: budgetRows,
    goals: goals.slice(0, 6),
    debts: debts.slice(0, 6),
    household: {
      memberCount: members,
      hasPendingBalance: false,
      summaryText: members > 1 ? `Hogar con ${members} miembros activos.` : "Hogar personal.",
    },
    signals: {
      highImpactTransactions: highImpact,
      repeatedSmallExpenses: repeatedGroups.slice(0, 5),
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseMonth(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error(`Formato de mes inválido: ${month}`);
  return { year: Number(match[1]), monthNumber: Number(match[2]) };
}

function getPreviousMonth(year: number, monthNumber: number) {
  return monthNumber === 1
    ? { year: year - 1, monthNumber: 12 }
    : { year, monthNumber: monthNumber - 1 };
}

type RawTx = {
  type: string;
  currency: string;
  amount: number;
  description: string | null;
  categoryName: string | null;
};

async function fetchMonthSummary(householdId: string, year: number, monthNumber: number): Promise<RawTx[]> {
  const { start, end } = argentinaMonthRangeUtc(year, monthNumber);

  const rows = await prisma.transaction.findMany({
    where: {
      householdId,
      deletedAt: null,
      status: { not: TransactionStatus.CANCELED },
      type: { in: ["INCOME", "EXPENSE", "CARD_PAYMENT"] },
      occurredAt: { gte: start, lt: end },
    },
    select: {
      type: true,
      currency: true,
      amount: true,
      description: true,
      category: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    type: r.type,
    currency: r.currency,
    amount: Number(r.amount),
    description: r.description,
    categoryName: r.category?.name ?? null,
  }));
}

async function fetchGoals(householdId: string) {
  const goals = await prisma.goal.findMany({
    where: { householdId, status: "ACTIVE", deletedAt: null },
    select: {
      name: true,
      targetAmount: true,
      currentAmount: true,
      requiredMonthlyAmount: true,
      currency: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return goals.map((g) => {
    const target = Number(g.targetAmount);
    const current = Number(g.currentAmount);
    return {
      name: g.name,
      targetAmount: target,
      currentAmount: current,
      progressPercent: target > 0 ? round((current / target) * 100) : 0,
      monthlyContribution: Number(g.requiredMonthlyAmount ?? 0),
      currency: g.currency,
    };
  });
}

async function fetchDebts(householdId: string) {
  const debts = await prisma.debt.findMany({
    where: {
      householdId,
      deletedAt: null,
      status: { in: [DebtStatus.ACTIVE, DebtStatus.PAUSED] },
      outstandingAmount: { gt: 0 },
    },
    select: {
      name: true,
      outstandingAmount: true,
      currency: true,
      minimumPayment: true,
    },
    orderBy: { outstandingAmount: "desc" },
  });

  return debts.map((d) => ({
    name: d.name,
    outstanding: Number(d.outstandingAmount),
    currency: d.currency,
    minimumPayment: Number(d.minimumPayment ?? 0),
  }));
}

async function fetchBudgets(householdId: string, year: number, month: number) {
  const { start, end } = argentinaMonthRangeUtc(year, month);

  const budgets = await prisma.budget.findMany({
    where: { householdId, year, month, deletedAt: null },
    select: {
      plannedAmount: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  });

  const spending = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      householdId,
      deletedAt: null,
      status: { not: TransactionStatus.CANCELED },
      type: { in: ["EXPENSE", "CARD_PAYMENT"] },
      occurredAt: { gte: start, lt: end },
    },
    _sum: { amount: true },
  });

  const spendMap = new Map(spending.map((s) => [s.categoryId, Number(s._sum.amount ?? 0)]));

  return budgets.map((b) => ({
    categoryName: b.category.name,
    planned: Number(b.plannedAmount),
    actual: spendMap.get(b.categoryId) ?? 0,
  }));
}

async function fetchRecurring(householdId: string) {
  const rows = await prisma.recurringExpense.findMany({
    where: { householdId, deletedAt: null, isActive: true },
    select: {
      name: true,
      amount: true,
      currency: true,
      category: { select: { name: true } },
    },
    orderBy: { amount: "desc" },
  });

  return rows.map((r) => ({
    description: r.name,
    amount: Number(r.amount),
    currency: r.currency,
    category: r.category?.name ?? "Sin categoría",
  }));
}

function sumByType(txs: RawTx[], types: string[]) {
  return round(txs.filter((t) => types.includes(t.type)).reduce((s, t) => s + t.amount, 0));
}

function groupByCategory(txs: RawTx[]) {
  const map = new Map<string, number>();
  for (const t of txs) {
    const name = t.categoryName ?? "Sin categoría";
    map.set(name, (map.get(name) ?? 0) + t.amount);
  }
  return Array.from(map.entries())
    .map(([name, total]) => ({ name, total: round(total) }))
    .sort((a, b) => b.total - a.total);
}

function buildCategoryChanges(
  current: Array<{ name: string; total: number }>,
  previous: Array<{ name: string; total: number }>,
) {
  const prevMap = new Map(previous.map((c) => [c.name, c.total]));
  return current.slice(0, 8).map((c) => {
    const prevTotal = prevMap.get(c.name) ?? 0;
    return {
      category: c.name,
      currentAmount: c.total,
      previousAmount: prevTotal,
      changePercent: prevTotal > 0 ? round(((c.total - prevTotal) / prevTotal) * 100) : null,
    };
  });
}

function detectRepeated(txs: RawTx[]) {
  const map = new Map<string, { count: number; total: number }>();
  for (const t of txs) {
    const key = (t.description ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\d+/g, "")
      .replace(/[^a-z ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    if (key.length < 3) continue;
    const entry = map.get(key) ?? { count: 0, total: 0 };
    entry.count++;
    entry.total += t.amount;
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .filter(([, v]) => v.count >= 2)
    .map(([description, v]) => ({ description, count: v.count, total: round(v.total) }))
    .sort((a, b) => b.total - a.total);
}

function round(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
