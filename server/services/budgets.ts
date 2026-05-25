import { BudgetPeriod, CategoryType, Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { argentinaMonthRangeUtc } from "@/lib/dates";
import { prisma } from "../../lib/prisma";
import { ForbiddenError, NotFoundError } from "../api/errors";
import { computeBudgetReservation } from "./financial-ledger";
import type {
  BudgetPeriodInput,
  CreateBudgetInput,
  UpdateBudgetInput,
} from "../schemas/budgets";
import { assertHouseholdAccess } from "./households";

const activeTransactionWhere = {
  deletedAt: null,
  status: { not: TransactionStatus.CANCELED },
} satisfies Prisma.TransactionWhereInput;

const SUGGESTION_HISTORY_MONTHS = 3;
const MAX_SUGGESTIONS = 8;

export async function listBudgets(userProfileId: string, input: BudgetPeriodInput) {
  const period = resolvePeriod(input.year, input.month);
  await assertHouseholdAccess(userProfileId, input.householdId);

  const [budgets, spendingByCategory] = await Promise.all([
    prisma.budget.findMany({
      where: {
        householdId: input.householdId,
        year: period.year,
        month: period.month,
        deletedAt: null,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
          },
        },
      },
      orderBy: {
        category: {
          name: "asc",
        },
      },
    }),
    getRealSpendingByCategory(input.householdId, period.year, period.month),
  ]);

  return budgets.map((budget) => {
    const spentAmount = spendingByCategory.get(budget.categoryId) ?? 0;
    const plannedAmount = toFiniteNumber(budget.plannedAmount);
    const remainingReserved = computeBudgetReservation({ plannedAmount, spentAmount });
    const usagePercent = plannedAmount > 0 ? (spentAmount / plannedAmount) * 100 : 0;

    return {
      id: budget.id,
      householdId: budget.householdId,
      categoryId: budget.categoryId,
      currency: budget.currency,
      year: budget.year,
      month: budget.month,
      plannedAmount,
      reservedAmount: remainingReserved,
      alertThreshold: budget.alertThreshold != null ? toFiniteNumber(budget.alertThreshold) : null,
      spentAmount,
      remainingReserved,
      usagePercent,
      category: budget.category,
      createdAt: budget.createdAt.toISOString(),
      updatedAt: budget.updatedAt.toISOString(),
    };
  });
}

export async function listBudgetSuggestions(userProfileId: string, input: BudgetPeriodInput) {
  const period = resolvePeriod(input.year, input.month);
  await assertHouseholdAccess(userProfileId, input.householdId);

  const { start: targetMonthStart } = argentinaMonthRangeUtc(period.year, period.month);
  const historyStart = addMonths(targetMonthStart, -SUGGESTION_HISTORY_MONTHS);

  const [household, categories, existingBudgets, historicalTransactions, recurringExpenses] = await Promise.all([
    prisma.household.findFirst({
      where: { id: input.householdId, deletedAt: null },
      select: { kind: true },
    }),
    prisma.category.findMany({
      where: {
        householdId: input.householdId,
        type: CategoryType.EXPENSE,
        deletedAt: null,
        isArchived: false,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.budget.findMany({
      where: {
        householdId: input.householdId,
        year: period.year,
        month: period.month,
        deletedAt: null,
      },
      select: { categoryId: true },
    }),
    prisma.transaction.findMany({
      where: {
        householdId: input.householdId,
        ...activeTransactionWhere,
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
        occurredAt: { gte: historyStart, lt: targetMonthStart },
      },
      select: {
        type: true,
        amount: true,
        categoryId: true,
        occurredAt: true,
      },
    }),
    prisma.recurringExpense.findMany({
      where: {
        householdId: input.householdId,
        isActive: true,
        deletedAt: null,
        OR: [{ endDate: null }, { endDate: { gte: targetMonthStart } }],
      },
      select: {
        categoryId: true,
        amount: true,
        frequency: true,
      },
    }),
  ]);

  const budgetedCategoryIds = new Set(existingBudgets.map((budget) => budget.categoryId));
  const availableCategories = categories.filter((category) => !budgetedCategoryIds.has(category.id));
  const incomeByMonth = new Map<string, number>();
  const spending = new Map<string, { total: number; count: number; months: Map<string, number> }>();

  historicalTransactions.forEach((transaction) => {
    const month = getHistoryMonthKey(transaction.occurredAt);
    const amount = toFiniteNumber(transaction.amount);

    if (transaction.type === TransactionType.INCOME) {
      incomeByMonth.set(month, (incomeByMonth.get(month) ?? 0) + amount);
      return;
    }

    if (transaction.type !== TransactionType.EXPENSE || !transaction.categoryId) return;

    const current = spending.get(transaction.categoryId) ?? {
      total: 0,
      count: 0,
      months: new Map<string, number>(),
    };
    current.total += amount;
    current.count += 1;
    current.months.set(month, (current.months.get(month) ?? 0) + amount);
    spending.set(transaction.categoryId, current);
  });

  const incomeTotal = Array.from(incomeByMonth.values()).reduce((sum, amount) => sum + amount, 0);
  const recentMonthlyIncome = incomeByMonth.size > 0 ? incomeTotal / incomeByMonth.size : 0;

  const recurringByCategory = recurringExpenses.reduce((totals, expense) => {
    if (!expense.categoryId) return totals;
    totals.set(
      expense.categoryId,
      (totals.get(expense.categoryId) ?? 0) + monthlyRecurringAmount(expense),
    );
    return totals;
  }, new Map<string, number>());

  const isHouseholdPlan = household?.kind === "HOUSEHOLD";
  const suggestions = availableCategories
    .map((category) => {
      const historical = spending.get(category.id);
      const recurringAmount = recurringByCategory.get(category.id) ?? 0;
      const activeMonths = historical?.months.size ?? 0;
      const monthlyAmounts = historical ? Array.from(historical.months.values()) : [];
      const recentAverage = historical ? historical.total / SUGGESTION_HISTORY_MONTHS : 0;
      const activeAverage = activeMonths > 0 && historical ? historical.total / activeMonths : 0;
      const medianAmount = getMedian(monthlyAmounts);
      const variability = getVariability(monthlyAmounts, activeAverage);
      const baselineAmount = getSuggestedBudgetAmount({
        recurringAmount,
        recentAverage,
        activeAverage,
        medianAmount,
        activeMonths,
        variability,
      });

      if (baselineAmount <= 0) return null;

      const suggestedAmount = roundBudgetAmount(baselineAmount);
      const incomeSharePercent =
        recentMonthlyIncome > 0 ? Math.round((suggestedAmount / recentMonthlyIncome) * 100) : null;

      return {
        categoryId: category.id,
        category,
        currency: "ARS" as const,
        suggestedAmount,
        recentAverage: Math.round(recentAverage),
        recurringAmount: Math.round(recurringAmount),
        activeMonths,
        transactionCount: historical?.count ?? 0,
        variability: getVariabilityLabel(variability, activeMonths),
        incomeSharePercent,
        confidence: getSuggestionConfidence(historical?.count ?? 0, recurringAmount, activeMonths),
        reason: getSuggestionReason({
          transactionCount: historical?.count ?? 0,
          recurringAmount,
          activeMonths,
          variability,
          isHouseholdPlan,
        }),
      };
    })
    .filter((suggestion): suggestion is NonNullable<typeof suggestion> => suggestion !== null)
    .filter((suggestion) => suggestion.suggestedAmount > 0)
    .sort((a, b) => {
      const confidenceRank = confidenceScore(b.confidence) - confidenceScore(a.confidence);
      if (confidenceRank !== 0) return confidenceRank;
      return b.suggestedAmount - a.suggestedAmount;
    })
    .slice(0, MAX_SUGGESTIONS);

  const totalSuggested = suggestions.reduce((sum, suggestion) => sum + suggestion.suggestedAmount, 0);
  const suggestedCap = recentMonthlyIncome > 0 ? recentMonthlyIncome * 0.85 : 0;
  const scale = suggestedCap > 0 && totalSuggested > suggestedCap ? suggestedCap / totalSuggested : 1;
  const adjustedSuggestions = suggestions.map((suggestion) => {
    const suggestedAmount = scale < 1 ? roundBudgetAmount(suggestion.suggestedAmount * scale) : suggestion.suggestedAmount;

    return {
      ...suggestion,
      suggestedAmount,
      incomeSharePercent:
        recentMonthlyIncome > 0 ? Math.round((suggestedAmount / recentMonthlyIncome) * 100) : null,
      reason:
        scale < 1
          ? `${suggestion.reason} Ajustado para no superar el ingreso reciente.`
          : suggestion.reason,
    };
  });

  return {
    period,
    recentMonthlyIncome: Math.round(recentMonthlyIncome),
    historyMonths: SUGGESTION_HISTORY_MONTHS,
    hasHistoricalActivity: spending.size > 0 || recurringByCategory.size > 0,
    suggestions: adjustedSuggestions,
  };
}

export async function createBudget(userProfileId: string, input: CreateBudgetInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);
  await assertBudgetCategory(input.householdId, input.categoryId);

  return prisma.budget.create({
    data: {
      householdId: input.householdId,
      createdById: userProfileId,
      categoryId: input.categoryId,
      currency: input.currency,
      period: BudgetPeriod.MONTHLY,
      year: input.year,
      month: input.month,
      plannedAmount: input.plannedAmount,
      alertThreshold: input.alertThreshold,
    },
  });
}

export async function updateBudget(userProfileId: string, budgetId: string, input: UpdateBudgetInput) {
  await assertBudgetAccess(userProfileId, budgetId, input.householdId);

  if (input.categoryId) {
    await assertBudgetCategory(input.householdId, input.categoryId);
  }

  return prisma.budget.update({
    where: {
      id: budgetId,
    },
    data: {
      categoryId: input.categoryId,
      currency: input.currency,
      year: input.year,
      month: input.month,
      plannedAmount: input.plannedAmount,
      alertThreshold: input.alertThreshold,
    },
  });
}

export async function deleteBudget(userProfileId: string, budgetId: string, householdId: string) {
  await assertBudgetAccess(userProfileId, budgetId, householdId);

  return prisma.budget.update({
    where: {
      id: budgetId,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}

async function assertBudgetAccess(userProfileId: string, budgetId: string, householdId: string) {
  await assertHouseholdAccess(userProfileId, householdId);

  const budget = await prisma.budget.findFirst({
    where: {
      id: budgetId,
      householdId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!budget) {
    throw new NotFoundError("Budget not found");
  }

  return budget;
}

async function assertBudgetCategory(householdId: string, categoryId: string) {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      householdId,
      type: CategoryType.EXPENSE,
      deletedAt: null,
      isArchived: false,
    },
    select: {
      id: true,
    },
  });

  if (!category) {
    throw new ForbiddenError("Budget category must be an active expense category in this household");
  }

  return category;
}

async function getRealSpendingByCategory(householdId: string, year: number, month: number) {
  const { start, end } = argentinaMonthRangeUtc(year, month);
  const transactions = await prisma.transaction.findMany({
    where: {
      householdId,
      type: TransactionType.EXPENSE,
      ...activeTransactionWhere,
      categoryId: {
        not: null,
      },
      occurredAt: {
        gte: start,
        lt: end,
      },
    },
    select: {
      categoryId: true,
      amount: true,
    },
  });

  return transactions.reduce((totals, transaction) => {
    if (!transaction.categoryId) {
      return totals;
    }

    totals.set(
      transaction.categoryId,
      (totals.get(transaction.categoryId) ?? 0) + toFiniteNumber(transaction.amount),
    );

    return totals;
  }, new Map<string, number>());
}

function resolvePeriod(year?: number, month?: number) {
  const now = new Date();

  return {
    year: year ?? now.getFullYear(),
    month: month ?? now.getMonth() + 1,
  };
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function getHistoryMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthlyRecurringAmount(expense: {
  amount: Prisma.Decimal | number;
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
}) {
  const amount = toFiniteNumber(expense.amount);

  switch (expense.frequency) {
    case "WEEKLY":
      return amount * 4.33;
    case "BIWEEKLY":
      return amount * 2.17;
    case "QUARTERLY":
      return amount / 3;
    case "YEARLY":
      return amount / 12;
    case "MONTHLY":
    default:
      return amount;
  }
}

function roundBudgetAmount(value: number) {
  if (value <= 10000) return Math.max(Math.round(value / 500) * 500, 500);
  if (value <= 100000) return Math.round(value / 1000) * 1000;
  return Math.round(value / 5000) * 5000;
}

function getMedian(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function getVariability(values: number[], average: number) {
  if (values.length < 2 || average <= 0) return 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (max - min) / average;
}

function getVariabilityLabel(variability: number, activeMonths: number) {
  if (activeMonths < 2) return "partial" as const;
  if (variability >= 0.8) return "variable" as const;
  return "stable" as const;
}

function getSuggestedBudgetAmount({
  recurringAmount,
  recentAverage,
  activeAverage,
  medianAmount,
  activeMonths,
  variability,
}: {
  recurringAmount: number;
  recentAverage: number;
  activeAverage: number;
  medianAmount: number;
  activeMonths: number;
  variability: number;
}) {
  if (recurringAmount > 0) {
    return Math.max(recurringAmount, activeMonths > 0 ? Math.max(recentAverage, medianAmount) : recurringAmount);
  }

  if (activeMonths === 0) return 0;
  if (activeMonths === 1) return recentAverage;
  if (variability >= 0.8) return medianAmount;
  return activeAverage;
}

function getSuggestionConfidence(transactionCount: number, recurringAmount: number, activeMonths: number) {
  if (recurringAmount > 0 || (transactionCount >= 4 && activeMonths >= 2)) return "high" as const;
  if (transactionCount > 0 && activeMonths >= 2) return "medium" as const;
  return "starter" as const;
}

function confidenceScore(confidence: "high" | "medium" | "starter") {
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  return 1;
}

function getSuggestionReason({
  transactionCount,
  recurringAmount,
  activeMonths,
  variability,
  isHouseholdPlan,
}: {
  transactionCount: number;
  recurringAmount: number;
  activeMonths: number;
  variability: number;
  isHouseholdPlan: boolean;
}) {
  const ownerContext = isHouseholdPlan ? " del hogar" : "";

  if (recurringAmount > 0 && transactionCount > 0) {
    return `Basado en gastos recientes${ownerContext} y pagos recurrentes activos.`;
  }

  if (recurringAmount > 0) {
    return `Basado en pagos recurrentes activos${ownerContext}.`;
  }

  if (activeMonths >= 2 && variability >= 0.8) {
    return `Basado en actividad real${ownerContext}; usamos un monto moderado porque varía mes a mes.`;
  }

  if (activeMonths >= 2) {
    return `Basado en actividad frecuente${ownerContext} durante los últimos meses.`;
  }

  if (transactionCount > 0) {
    return `Hay poco historial${ownerContext}; es un punto de partida suave basado en movimientos reales.`;
  }

  return "Sin actividad suficiente para sugerir un monto confiable.";
}

function toFiniteNumber(value: Prisma.Decimal | number) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}
