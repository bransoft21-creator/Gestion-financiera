import { BudgetPeriod, CategoryType, CurrencyCode, Prisma, TransactionStatus, TransactionType } from "@prisma/client";
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

type SuggestionCategory = {
  id: string;
  name: string;
  color: string | null;
};

type SuggestionTransaction = {
  householdId: string;
  type: TransactionType;
  status: TransactionStatus;
  currency: CurrencyCode;
  amount: Prisma.Decimal | number;
  categoryId: string | null;
  occurredAt: Date;
  origin?: string | null;
  category?: {
    type: CategoryType;
    deletedAt: Date | null;
    isArchived: boolean;
  } | null;
};

type SuggestionRecurringExpense = {
  categoryId: string | null;
  currency: CurrencyCode;
  amount: Prisma.Decimal | number;
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
};

export type BudgetSuggestionDiagnosticCode =
  | "NO_ACTIVITY"
  | "UNCATEGORIZED_ACTIVITY"
  | "OTHER_CURRENCY"
  | "PENDING_ACTIVITY"
  | "NO_CLASSIFIED_EXPENSES"
  | "ALL_CATEGORIES_BUDGETED";

export type BudgetSuggestionDiagnostic = {
  code: BudgetSuggestionDiagnosticCode;
  title: string;
  message: string;
  transactionCount: number;
  eligibleExpenseCount: number;
  classifiedExpenseCount: number;
  uncategorizedExpenseCount: number;
  pendingTransactionCount: number;
  otherCurrencyTransactionCount: number;
  excludedTypeTransactionCount: number;
  unsupportedCategoryTransactionCount: number;
  currency: CurrencyCode;
  otherCurrencies: { currency: CurrencyCode; count: number }[];
};

export function getBudgetSuggestionWindow(year: number, month: number, now = new Date()) {
  const { start: targetMonthStart, end: targetMonthEnd } = argentinaMonthRangeUtc(year, month);
  const includesTargetMonth = now >= targetMonthStart;

  return {
    start: addMonths(targetMonthStart, includesTargetMonth ? -(SUGGESTION_HISTORY_MONTHS - 1) : -SUGGESTION_HISTORY_MONTHS),
    end: includesTargetMonth ? targetMonthEnd : targetMonthStart,
    targetMonthStart,
    targetMonthEnd,
    includesTargetMonth,
    historyMonths: SUGGESTION_HISTORY_MONTHS,
  };
}

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

  const suggestionWindow = getBudgetSuggestionWindow(period.year, period.month);

  const household = await prisma.household.findFirst({
    where: { id: input.householdId, deletedAt: null },
    select: { kind: true, defaultCurrency: true },
  });
  const primaryCurrency = household?.defaultCurrency ?? CurrencyCode.ARS;

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
        deletedAt: null,
        occurredAt: { gte: suggestionWindow.start, lt: suggestionWindow.end },
      },
      select: {
        householdId: true,
        type: true,
        status: true,
        currency: true,
        amount: true,
        categoryId: true,
        occurredAt: true,
        origin: true,
        category: {
          select: {
            type: true,
            deletedAt: true,
            isArchived: true,
          },
        },
      },
    }),
    prisma.recurringExpense.findMany({
      where: {
        householdId: input.householdId,
        isActive: true,
        deletedAt: null,
        currency: primaryCurrency,
        OR: [{ endDate: null }, { endDate: { gte: suggestionWindow.targetMonthStart } }],
      },
      select: {
        categoryId: true,
        currency: true,
        amount: true,
        frequency: true,
      },
    }),
  ]);

  return buildBudgetSuggestionsFromActivity({
    householdId: input.householdId,
    period,
    householdKind: household?.kind ?? "PERSONAL",
    primaryCurrency,
    categories,
    existingBudgetCategoryIds: existingBudgets.map((budget) => budget.categoryId),
    transactions: historicalTransactions,
    recurringExpenses,
    historyMonths: suggestionWindow.historyMonths,
  });
}

export function buildBudgetSuggestionsFromActivity({
  householdId,
  period,
  householdKind,
  primaryCurrency,
  categories,
  existingBudgetCategoryIds,
  transactions,
  recurringExpenses,
  historyMonths = SUGGESTION_HISTORY_MONTHS,
}: {
  householdId: string;
  period: { year: number; month: number };
  householdKind: "PERSONAL" | "HOUSEHOLD";
  primaryCurrency: CurrencyCode;
  categories: SuggestionCategory[];
  existingBudgetCategoryIds: string[];
  transactions: SuggestionTransaction[];
  recurringExpenses: SuggestionRecurringExpense[];
  historyMonths?: number;
}) {
  const budgetedCategoryIds = new Set(existingBudgetCategoryIds);
  const availableCategories = categories.filter((category) => !budgetedCategoryIds.has(category.id));
  const incomeByMonth = new Map<string, number>();
  const spending = new Map<string, { total: number; count: number; months: Map<string, number>; days: Set<string> }>();
  const scopedTransactions = transactions.filter((transaction) => transaction.householdId === householdId);

  scopedTransactions.forEach((transaction) => {
    if (transaction.status !== TransactionStatus.CONFIRMED) return;
    if (transaction.currency !== primaryCurrency) return;
    if (transaction.type !== TransactionType.INCOME && transaction.type !== TransactionType.EXPENSE) return;

    const month = getHistoryMonthKey(transaction.occurredAt);
    const amount = toFiniteNumber(transaction.amount);

    if (transaction.type === TransactionType.INCOME) {
      incomeByMonth.set(month, (incomeByMonth.get(month) ?? 0) + amount);
      return;
    }

    if (
      transaction.type !== TransactionType.EXPENSE ||
      !transaction.categoryId ||
      transaction.category?.type !== CategoryType.EXPENSE ||
      transaction.category?.deletedAt ||
      transaction.category?.isArchived
    ) {
      return;
    }

    const current = spending.get(transaction.categoryId) ?? {
      total: 0,
      count: 0,
      months: new Map<string, number>(),
      days: new Set<string>(),
    };
    current.total += amount;
    current.count += 1;
    current.months.set(month, (current.months.get(month) ?? 0) + amount);
    current.days.add(getHistoryDayKey(transaction.occurredAt));
    spending.set(transaction.categoryId, current);
  });

  const incomeTotal = Array.from(incomeByMonth.values()).reduce((sum, amount) => sum + amount, 0);
  const recentMonthlyIncome = incomeByMonth.size > 0 ? incomeTotal / incomeByMonth.size : 0;

  const recurringByCategory = recurringExpenses.reduce((totals, expense) => {
    if (!expense.categoryId) return totals;
    if (expense.currency !== primaryCurrency) return totals;
    totals.set(
      expense.categoryId,
      (totals.get(expense.categoryId) ?? 0) + monthlyRecurringAmount(expense),
    );
    return totals;
  }, new Map<string, number>());

  const isHouseholdPlan = householdKind === "HOUSEHOLD";
  const suggestions = availableCategories
    .map((category) => {
      const historical = spending.get(category.id);
      const recurringAmount = recurringByCategory.get(category.id) ?? 0;
      const activeMonths = historical?.months.size ?? 0;
      const activeDays = historical?.days.size ?? 0;
      const monthlyAmounts = historical ? Array.from(historical.months.values()) : [];
      const recentAverage = historical ? historical.total / historyMonths : 0;
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
        currency: primaryCurrency,
        suggestedAmount,
        recentAverage: Math.round(recentAverage),
        recurringAmount: Math.round(recurringAmount),
        activeMonths,
        transactionCount: historical?.count ?? 0,
        variability: getVariabilityLabel(variability, activeMonths),
        incomeSharePercent,
        confidence: getSuggestionConfidence(historical?.count ?? 0, recurringAmount, activeMonths, activeDays),
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
  const classifiedExpenseCount = Array.from(spending.values()).reduce((sum, item) => sum + item.count, 0);
  const unbudgetedClassifiedExpenseCount = Array.from(spending.entries()).reduce((sum, [categoryId, item]) => {
    if (budgetedCategoryIds.has(categoryId)) return sum;
    return sum + item.count;
  }, 0);

  return {
    period,
    recentMonthlyIncome: Math.round(recentMonthlyIncome),
    historyMonths,
    hasHistoricalActivity: scopedTransactions.length > 0 || recurringByCategory.size > 0,
    activitySummary: buildSuggestionActivitySummary(scopedTransactions, primaryCurrency),
    diagnostic: getBudgetSuggestionDiagnostic({
      transactions: scopedTransactions,
      primaryCurrency,
      classifiedExpenseCount,
      eligibleExpenseCount: classifiedExpenseCount,
      unbudgetedClassifiedExpenseCount,
      recurringCategoryCount: recurringByCategory.size,
      availableCategoryCount: availableCategories.length,
      suggestionCount: adjustedSuggestions.length,
    }),
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

function getHistoryDayKey(date: Date) {
  return `${getHistoryMonthKey(date)}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function buildSuggestionActivitySummary(transactions: SuggestionTransaction[], primaryCurrency: CurrencyCode) {
  const activeTransactions = transactions.filter((transaction) => transaction.status !== TransactionStatus.CANCELED);
  const confirmedPrimaryExpenses = activeTransactions.filter(
    (transaction) =>
      transaction.status === TransactionStatus.CONFIRMED &&
      transaction.currency === primaryCurrency &&
      transaction.type === TransactionType.EXPENSE,
  );
  const classifiedExpenseCount = confirmedPrimaryExpenses.filter(isActiveExpenseCategoryTransaction).length;
  const uncategorizedExpenseCount = confirmedPrimaryExpenses.filter((transaction) => !transaction.categoryId).length;
  const unsupportedCategoryTransactionCount = confirmedPrimaryExpenses.filter(
    (transaction) => transaction.categoryId && !isActiveExpenseCategoryTransaction(transaction),
  ).length;
  const otherCurrencyCounts = activeTransactions.reduce((totals, transaction) => {
    if (transaction.currency === primaryCurrency) return totals;
    totals.set(transaction.currency, (totals.get(transaction.currency) ?? 0) + 1);
    return totals;
  }, new Map<CurrencyCode, number>());

  return {
    transactionCount: transactions.length,
    confirmedTransactionCount: activeTransactions.filter((transaction) => transaction.status === TransactionStatus.CONFIRMED).length,
    pendingTransactionCount: activeTransactions.filter((transaction) => transaction.status === TransactionStatus.PENDING).length,
    incomeCount: activeTransactions.filter(
      (transaction) => transaction.currency === primaryCurrency && transaction.type === TransactionType.INCOME,
    ).length,
    expenseCount: confirmedPrimaryExpenses.length,
    classifiedExpenseCount,
    uncategorizedExpenseCount,
    otherCurrencyTransactionCount: Array.from(otherCurrencyCounts.values()).reduce((sum, count) => sum + count, 0),
    excludedTypeTransactionCount: activeTransactions.filter(
      (transaction) =>
        transaction.currency === primaryCurrency &&
        transaction.type !== TransactionType.INCOME &&
        transaction.type !== TransactionType.EXPENSE,
    ).length,
    unsupportedCategoryTransactionCount,
    currency: primaryCurrency,
    otherCurrencies: Array.from(otherCurrencyCounts.entries()).map(([currency, count]) => ({ currency, count })),
  };
}

function getBudgetSuggestionDiagnostic({
  transactions,
  primaryCurrency,
  classifiedExpenseCount,
  eligibleExpenseCount,
  unbudgetedClassifiedExpenseCount,
  recurringCategoryCount,
  availableCategoryCount,
  suggestionCount,
}: {
  transactions: SuggestionTransaction[];
  primaryCurrency: CurrencyCode;
  classifiedExpenseCount: number;
  eligibleExpenseCount: number;
  unbudgetedClassifiedExpenseCount: number;
  recurringCategoryCount: number;
  availableCategoryCount: number;
  suggestionCount: number;
}): BudgetSuggestionDiagnostic | null {
  if (suggestionCount > 0) return null;

  const summary = buildSuggestionActivitySummary(transactions, primaryCurrency);
  const base = {
    transactionCount: summary.transactionCount,
    eligibleExpenseCount,
    classifiedExpenseCount,
    uncategorizedExpenseCount: summary.uncategorizedExpenseCount,
    pendingTransactionCount: summary.pendingTransactionCount,
    otherCurrencyTransactionCount: summary.otherCurrencyTransactionCount,
    excludedTypeTransactionCount: summary.excludedTypeTransactionCount,
    unsupportedCategoryTransactionCount: summary.unsupportedCategoryTransactionCount,
    currency: primaryCurrency,
    otherCurrencies: summary.otherCurrencies,
  };

  if (summary.transactionCount === 0 && recurringCategoryCount === 0) {
    return {
      ...base,
      code: "NO_ACTIVITY",
      title: "Creá tu primer plan de distribución",
      message: "No encontramos movimientos en el período analizado. Cuando cargues gastos reales, Meridian va a preparar una base editable.",
    };
  }

  if (summary.otherCurrencyTransactionCount > 0 && classifiedExpenseCount === 0) {
    const currencies = summary.otherCurrencies.map((item) => item.currency).join(", ");
    return {
      ...base,
      code: "OTHER_CURRENCY",
      title: "Hay movimientos en otra moneda",
      message: `Encontramos ${summary.transactionCount} movimientos, pero el plan actual está en ${primaryCurrency}${currencies ? ` y la actividad está en ${currencies}` : ""}.`,
    };
  }

  if (summary.pendingTransactionCount > 0 && classifiedExpenseCount === 0) {
    return {
      ...base,
      code: "PENDING_ACTIVITY",
      title: "Tus movimientos están pendientes de revisión",
      message: `Encontramos ${summary.pendingTransactionCount} movimientos pendientes. Confirmalos para que entren en las sugerencias del presupuesto.`,
    };
  }

  if (summary.uncategorizedExpenseCount > 0 && classifiedExpenseCount === 0) {
    return {
      ...base,
      code: "UNCATEGORIZED_ACTIVITY",
      title: "Tenés movimientos sin clasificar",
      message: `Encontramos ${summary.transactionCount} movimientos, pero ${summary.uncategorizedExpenseCount} gastos están sin clasificar. Clasificalos para generar sugerencias.`,
    };
  }

  if (classifiedExpenseCount > 0 && (availableCategoryCount === 0 || unbudgetedClassifiedExpenseCount === 0)) {
    return {
      ...base,
      code: "ALL_CATEGORIES_BUDGETED",
      title: "Las categorías activas ya tienen plan",
      message: "Todas las categorías con actividad ya están cubiertas. Podés ajustar cualquier intención activa o agregar una nueva manualmente.",
    };
  }

  return {
    ...base,
    code: "NO_CLASSIFIED_EXPENSES",
    title: "Todavía no hay gastos clasificados suficientes",
    message:
      summary.excludedTypeTransactionCount > 0 || summary.unsupportedCategoryTransactionCount > 0
        ? `Encontramos ${summary.transactionCount} movimientos, pero no hay gastos clasificados compatibles con el presupuesto.`
        : "Ya hay movimientos, pero necesitamos algunos gastos clasificados para sugerir montos.",
  };
}

function isActiveExpenseCategoryTransaction(transaction: SuggestionTransaction) {
  const category = transaction.category;

  return (
    !!transaction.categoryId &&
    category?.type === CategoryType.EXPENSE &&
    !category.deletedAt &&
    !category.isArchived
  );
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
  if (activeMonths === 1) return activeAverage;
  if (variability >= 0.8) return medianAmount;
  return activeAverage;
}

function getSuggestionConfidence(transactionCount: number, recurringAmount: number, activeMonths: number, activeDays: number) {
  if (recurringAmount > 0 || (transactionCount >= 4 && activeMonths >= 2)) return "high" as const;
  if (transactionCount >= 12 && activeDays >= 20) return "high" as const;
  if (transactionCount >= 4 || (transactionCount > 0 && activeMonths >= 2)) return "medium" as const;
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
