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

const SUGGESTION_HISTORY_MONTHS = 4;
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

  const [categories, existingBudgets, historicalTransactions, recurringExpenses] = await Promise.all([
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
  const incomeTotal = historicalTransactions
    .filter((transaction) => transaction.type === TransactionType.INCOME)
    .reduce((sum, transaction) => sum + toFiniteNumber(transaction.amount), 0);
  const recentMonthlyIncome = incomeTotal / SUGGESTION_HISTORY_MONTHS;
  const spending = new Map<string, { total: number; count: number }>();

  historicalTransactions.forEach((transaction) => {
    if (transaction.type !== TransactionType.EXPENSE || !transaction.categoryId) return;
    const current = spending.get(transaction.categoryId) ?? { total: 0, count: 0 };
    current.total += toFiniteNumber(transaction.amount);
    current.count += 1;
    spending.set(transaction.categoryId, current);
  });

  const recurringByCategory = recurringExpenses.reduce((totals, expense) => {
    if (!expense.categoryId) return totals;
    totals.set(
      expense.categoryId,
      (totals.get(expense.categoryId) ?? 0) + monthlyRecurringAmount(expense),
    );
    return totals;
  }, new Map<string, number>());

  const fallbackAmount = recentMonthlyIncome > 0 ? roundBudgetAmount(recentMonthlyIncome * 0.03) : 10000;
  const suggestions = availableCategories
    .map((category) => {
      const historical = spending.get(category.id);
      const recentAverage = historical ? historical.total / SUGGESTION_HISTORY_MONTHS : 0;
      const recurringAmount = recurringByCategory.get(category.id) ?? 0;
      const baselineAmount = Math.max(recentAverage, recurringAmount);
      const suggestedAmount = roundBudgetAmount(baselineAmount > 0 ? baselineAmount : fallbackAmount);
      const incomeSharePercent =
        recentMonthlyIncome > 0 ? Math.round((suggestedAmount / recentMonthlyIncome) * 100) : null;

      return {
        categoryId: category.id,
        category,
        currency: "ARS" as const,
        suggestedAmount,
        recentAverage: Math.round(recentAverage),
        recurringAmount: Math.round(recurringAmount),
        incomeSharePercent,
        confidence: getSuggestionConfidence(historical?.count ?? 0, recurringAmount),
        reason: getSuggestionReason(historical?.count ?? 0, recurringAmount),
      };
    })
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
      reservedAmount: input.reservedAmount,
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
      reservedAmount: input.reservedAmount,
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

function getSuggestionConfidence(transactionCount: number, recurringAmount: number) {
  if (recurringAmount > 0 || transactionCount >= 4) return "high" as const;
  if (transactionCount > 0) return "medium" as const;
  return "starter" as const;
}

function confidenceScore(confidence: "high" | "medium" | "starter") {
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  return 1;
}

function getSuggestionReason(transactionCount: number, recurringAmount: number) {
  if (recurringAmount > 0 && transactionCount > 0) {
    return "Basado en gasto histórico y cargos recurrentes.";
  }

  if (recurringAmount > 0) {
    return "Basado en cargos recurrentes activos.";
  }

  if (transactionCount >= 4) {
    return "Basado en un patrón frecuente de gasto.";
  }

  if (transactionCount > 0) {
    return "Basado en movimientos recientes.";
  }

  return "Punto de partida editable para no arrancar desde cero.";
}

function toFiniteNumber(value: Prisma.Decimal | number) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}
