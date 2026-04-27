import { BudgetPeriod, CategoryType, Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ForbiddenError, NotFoundError } from "../api/errors";
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
    const usagePercent = plannedAmount > 0 ? (spentAmount / plannedAmount) * 100 : 0;

    return {
      id: budget.id,
      householdId: budget.householdId,
      categoryId: budget.categoryId,
      currency: budget.currency,
      year: budget.year,
      month: budget.month,
      plannedAmount,
      reservedAmount: toFiniteNumber(budget.reservedAmount),
      alertThreshold: budget.alertThreshold ? toFiniteNumber(budget.alertThreshold) : null,
      spentAmount,
      usagePercent,
      category: budget.category,
      createdAt: budget.createdAt.toISOString(),
      updatedAt: budget.updatedAt.toISOString(),
    };
  });
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
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
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

function toFiniteNumber(value: Prisma.Decimal | number) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}
