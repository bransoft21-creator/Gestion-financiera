import { DebtStatus, GoalStatus, Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { argentinaMonthRangeUtc } from "@/lib/dates";
import { prisma } from "../../lib/prisma";
import { computeFinancialHealth, toFiniteNumber } from "./financial-ledger";
import { assertHouseholdAccess } from "./households";

const chartColors = ["#f97316", "#ef4444", "#06b6d4", "#eab308", "#8b5cf6", "#14b8a6"];
const activeTransactionWhere = {
  deletedAt: null,
  status: { not: TransactionStatus.CANCELED },
} satisfies Prisma.TransactionWhereInput;

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

  const { start: monthStart, end: nextMonthStart } = argentinaMonthRangeUtc(year, month);

  const [
    monthTransactions,
    latestTransactions,
    budgets,
    debtAggregate,
    recurringExpenses,
    activeGoals,
    upcomingDebts,
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        householdId,
        ...activeTransactionWhere,
        occurredAt: { gte: monthStart, lt: nextMonthStart },
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
      },
      include: dashboardTransactionInclude,
      orderBy: { occurredAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: {
        householdId,
        ...activeTransactionWhere,
        occurredAt: { gte: monthStart, lt: nextMonthStart },
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
    prisma.recurringExpense.findMany({
      where: {
        householdId,
        isActive: true,
        deletedAt: null,
        nextDueDate: { gte: monthStart, lt: nextMonthStart },
        OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
      },
      select: { amount: true },
    }),
    prisma.goal.findMany({
      where: {
        householdId,
        status: GoalStatus.ACTIVE,
        deletedAt: null,
        requiredMonthlyAmount: { not: null },
      },
      select: { requiredMonthlyAmount: true },
    }),
    prisma.debt.findMany({
      where: {
        householdId,
        status: DebtStatus.ACTIVE,
        deletedAt: null,
        nextDueDate: { gte: monthStart, lt: nextMonthStart },
      },
      select: { minimumPayment: true, outstandingAmount: true },
    }),
  ]);

  const income = sumTransactionsByType(monthTransactions, TransactionType.INCOME);
  const expenses = sumTransactionsByType(monthTransactions, TransactionType.EXPENSE);
  const expensesByCategory = getExpensesByCategory(monthTransactions);
  const expenseCategoryDetails = getExpenseCategoryDetails(monthTransactions);
  const expensesByCategoryId = getExpenseTotalsByCategoryId(monthTransactions);
  const health = computeFinancialHealth({
    income,
    expenses,
    budgets: budgets.map((budget) => ({
      plannedAmount: budget.plannedAmount,
      spentAmount: expensesByCategoryId.get(budget.categoryId) ?? 0,
    })),
    recurringExpenses,
    goals: activeGoals,
    debts: upcomingDebts,
    totalOutstandingDebt: debtAggregate._sum.outstandingAmount ?? 0,
  });

  return {
    period: {
      year,
      month,
      from: monthStart.toISOString(),
      to: nextMonthStart.toISOString(),
    },
    metrics: health,
    expensesByCategory,
    expenseCategoryDetails,
    latestTransactions: latestTransactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      currency: transaction.currency,
      amount: toFiniteNumber(transaction.amount),
      description: transaction.description,
      occurredAt: transaction.occurredAt.toISOString(),
      account: transaction.account,
      category: transaction.category,
    })),
    alerts: buildAlerts({
      income,
      expenses,
      balance: health.balance,
      estimatedSavings: health.estimatedSavings,
      transactionCount: monthTransactions.length,
      expensesByCategory,
      remainingReservedBudget: health.remainingReservedBudget,
      upcomingObligations: health.upcomingObligations,
      realAvailable: health.realAvailable,
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
      (totals.get(transaction.category.id) ?? 0) + toFiniteNumber(transaction.amount),
    );

    return totals;
  }, new Map<string, number>());
}

function sumTransactionsByType(transactions: DashboardTransaction[], type: TransactionType) {
  return transactions.reduce((total, transaction) => {
    if (transaction.type !== type) {
      return total;
    }

    return total + toFiniteNumber(transaction.amount);
  }, 0);
}

function getExpensesByCategory(transactions: DashboardTransaction[]) {
  const totals = new Map<string, { id: string; name: string; value: number; color: string }>();

  transactions.forEach((transaction) => {
    if (transaction.type !== TransactionType.EXPENSE) {
      return;
    }

    const key = transaction.category?.id ?? "uncategorized";
    const existing = totals.get(key);
    const nextValue = (existing?.value ?? 0) + toFiniteNumber(transaction.amount);

    totals.set(key, {
      id: key,
      name: transaction.category?.name ?? "Sin categoría",
      value: nextValue,
      color: transaction.category?.color ?? chartColors[totals.size % chartColors.length],
    });
  });

  return Array.from(totals.values()).sort((a, b) => b.value - a.value);
}

function getExpenseCategoryDetails(transactions: DashboardTransaction[]) {
  const details = new Map<string, {
    id: string;
    name: string;
    total: number;
    items: Array<{
      id: string;
      description: string | null;
      amount: number;
      currency: string;
      occurredAt: string;
      account: { id: string; name: string };
    }>;
  }>();

  transactions.forEach((transaction) => {
    if (transaction.type !== TransactionType.EXPENSE) {
      return;
    }

    const key = transaction.category?.id ?? "uncategorized";
    const amount = toFiniteNumber(transaction.amount);
    const existing = details.get(key);

    details.set(key, {
      id: key,
      name: transaction.category?.name ?? "Sin categoría",
      total: (existing?.total ?? 0) + amount,
      items: [
        ...(existing?.items ?? []),
        {
          id: transaction.id,
          description: transaction.description,
          amount,
          currency: transaction.currency,
          occurredAt: transaction.occurredAt.toISOString(),
          account: transaction.account,
        },
      ],
    });
  });

  return Array.from(details.values()).sort((a, b) => b.total - a.total);
}

function buildAlerts({
  income,
  expenses,
  balance,
  estimatedSavings,
  transactionCount,
  expensesByCategory,
  remainingReservedBudget,
  upcomingObligations,
  realAvailable,
}: {
  income: number;
  expenses: number;
  balance: number;
  estimatedSavings: number;
  transactionCount: number;
  expensesByCategory: Array<{ name: string; value: number }>;
  remainingReservedBudget: number;
  upcomingObligations: number;
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

  if (upcomingObligations > 0) {
    alerts.push("El disponible real descuenta obligaciones próximas del mes.");
  }

  if (realAvailable < 0) {
    alerts.push("El dinero disponible real queda en negativo al reservar presupuestos y obligaciones.");
  }

  const topCategory = expensesByCategory[0];
  if (topCategory && expenses > 0 && topCategory.value / expenses >= 0.4) {
    alerts.push(`${topCategory.name} concentra más del 40% de los gastos del mes.`);
  }

  return alerts.slice(0, 4);
}
