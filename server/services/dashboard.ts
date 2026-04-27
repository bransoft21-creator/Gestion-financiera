import { DebtStatus, Prisma, TransactionType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { assertHouseholdAccess } from "./households";

const chartColors = ["#f97316", "#ef4444", "#06b6d4", "#eab308", "#8b5cf6", "#14b8a6"];

const dashboardTransactionInclude = {
  account: {
    select: {
      id: true,
      name: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      color: true,
    },
  },
} satisfies Prisma.TransactionInclude;

type DashboardTransaction = Prisma.TransactionGetPayload<{
  include: typeof dashboardTransactionInclude;
}>;

export async function getDashboardSummary(
  userProfileId: string,
  householdId: string,
  year: number,
  month: number,
) {
  await assertHouseholdAccess(userProfileId, householdId);

  const monthStart = new Date(year, month - 1, 1);
  const nextMonthStart = new Date(year, month, 1);

  const [monthTransactions, latestTransactions, budgets, debtAggregate] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        householdId,
        deletedAt: null,
        occurredAt: { gte: monthStart, lt: nextMonthStart },
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
      },
      include: dashboardTransactionInclude,
      orderBy: { occurredAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: {
        householdId,
        deletedAt: null,
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
      },
      include: dashboardTransactionInclude,
      orderBy: { occurredAt: "desc" },
      take: 5,
    }),
    prisma.budget.findMany({
      where: { householdId, year, month, deletedAt: null },
      select: { categoryId: true, plannedAmount: true },
    }),
    prisma.debt.aggregate({
      _sum: { outstandingAmount: true },
      where: { householdId, status: DebtStatus.ACTIVE, deletedAt: null },
    }),
  ]);

  const income = sumTransactionsByType(monthTransactions, TransactionType.INCOME);
  const expenses = sumTransactionsByType(monthTransactions, TransactionType.EXPENSE);
  const balance = income - expenses;
  const estimatedSavings = Math.max(balance, 0);
  const savingsRate = income > 0 ? Math.round((estimatedSavings / income) * 100) : 0;
  const expensesByCategory = getExpensesByCategory(monthTransactions);
  const expensesByCategoryId = getExpenseTotalsByCategoryId(monthTransactions);
  const budgetMetrics = getBudgetMetrics(budgets, expensesByCategoryId);
  const available = balance - budgetMetrics.remainingReserved;
  const totalOutstandingDebt = Number(debtAggregate._sum.outstandingAmount ?? 0);

  return {
    period: {
      year,
      month,
      from: monthStart.toISOString(),
      to: nextMonthStart.toISOString(),
    },
    metrics: {
      income,
      expenses,
      balance,
      estimatedSavings,
      savingsRate,
      totalBudgeted: budgetMetrics.totalBudgeted,
      budgetedSpent: budgetMetrics.budgetedSpent,
      remainingReservedBudget: budgetMetrics.remainingReserved,
      realAvailable: available,
      totalOutstandingDebt,
    },
    expensesByCategory,
    latestTransactions: latestTransactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      currency: transaction.currency,
      amount: Number(transaction.amount),
      description: transaction.description,
      occurredAt: transaction.occurredAt.toISOString(),
      account: transaction.account,
      category: transaction.category,
    })),
    alerts: buildAlerts({
      income,
      expenses,
      balance,
      estimatedSavings,
      transactionCount: monthTransactions.length,
      expensesByCategory,
      remainingReservedBudget: budgetMetrics.remainingReserved,
      realAvailable: available,
    }),
  };
}

function getExpenseTotalsByCategoryId(transactions: DashboardTransaction[]) {
  return transactions.reduce((totals, transaction) => {
    if (transaction.type !== TransactionType.EXPENSE || !transaction.category?.id) {
      return totals;
    }

    totals.set(
      transaction.category.id,
      (totals.get(transaction.category.id) ?? 0) + Number(transaction.amount),
    );

    return totals;
  }, new Map<string, number>());
}

function getBudgetMetrics(
  budgets: Array<{ categoryId: string; plannedAmount: Prisma.Decimal }>,
  expensesByCategoryId: Map<string, number>,
) {
  return budgets.reduce(
    (totals, budget) => {
      const plannedAmount = Number(budget.plannedAmount);
      const spentAmount = expensesByCategoryId.get(budget.categoryId) ?? 0;

      return {
        totalBudgeted: totals.totalBudgeted + plannedAmount,
        budgetedSpent: totals.budgetedSpent + spentAmount,
        remainingReserved: totals.remainingReserved + Math.max(plannedAmount - spentAmount, 0),
      };
    },
    {
      totalBudgeted: 0,
      budgetedSpent: 0,
      remainingReserved: 0,
    },
  );
}

function sumTransactionsByType(transactions: DashboardTransaction[], type: TransactionType) {
  return transactions.reduce((total, transaction) => {
    if (transaction.type !== type) {
      return total;
    }

    return total + Number(transaction.amount);
  }, 0);
}

function getExpensesByCategory(transactions: DashboardTransaction[]) {
  const totals = new Map<string, { name: string; value: number; color: string }>();

  transactions.forEach((transaction) => {
    if (transaction.type !== TransactionType.EXPENSE) {
      return;
    }

    const key = transaction.category?.id ?? "uncategorized";
    const existing = totals.get(key);
    const nextValue = (existing?.value ?? 0) + Number(transaction.amount);

    totals.set(key, {
      name: transaction.category?.name ?? "Sin categoría",
      value: nextValue,
      color: transaction.category?.color ?? chartColors[totals.size % chartColors.length],
    });
  });

  return Array.from(totals.values()).sort((a, b) => b.value - a.value);
}

function buildAlerts({
  income,
  expenses,
  balance,
  estimatedSavings,
  transactionCount,
  expensesByCategory,
  remainingReservedBudget,
  realAvailable,
}: {
  income: number;
  expenses: number;
  balance: number;
  estimatedSavings: number;
  transactionCount: number;
  expensesByCategory: Array<{ name: string; value: number }>;
  remainingReservedBudget: number;
  realAvailable: number;
}) {
  const alerts: string[] = [];

  if (transactionCount === 0) {
    alerts.push("Todavía no hay transacciones registradas este mes.");
  }

  if (income > 0 && expenses / income >= 0.8) {
    alerts.push("Los gastos del mes ya superan el 80% de los ingresos.");
  }

  if (balance < 0) {
    alerts.push("El balance mensual está en negativo.");
  }

  if (estimatedSavings > 0) {
    alerts.push("Hay balance positivo disponible para ahorro o reservas.");
  }

  if (remainingReservedBudget > 0) {
    alerts.push("Parte del balance queda reservado para presupuestos pendientes del mes.");
  }

  if (realAvailable < 0) {
    alerts.push("El dinero disponible real queda en negativo al reservar presupuestos pendientes.");
  }

  const topCategory = expensesByCategory[0];
  if (topCategory && expenses > 0 && topCategory.value / expenses >= 0.4) {
    alerts.push(`${topCategory.name} concentra más del 40% de los gastos del mes.`);
  }

  return alerts.slice(0, 4);
}
