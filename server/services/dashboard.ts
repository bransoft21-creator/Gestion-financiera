import { DebtStatus, GoalStatus, Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { argentinaMonthRangeUtc, formatArgentinaDateInput } from "@/lib/dates";
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
  const expensesByType = getExpensesByType(monthTransactions);
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

  const argDateStr = formatArgentinaDateInput();
  const [argYear, argMonth, argDay] = argDateStr.split("-").map(Number);
  const isCurrentMonth = argYear === year && argMonth === month;
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayOfMonth = isCurrentMonth ? argDay : daysInMonth;
  const projectedExpenses = dayOfMonth > 0 ? (expenses / dayOfMonth) * daysInMonth : expenses;
  const projectedBalance = income - projectedExpenses;

  return {
    period: {
      year,
      month,
      from: monthStart.toISOString(),
      to: nextMonthStart.toISOString(),
    },
    metrics: {
      ...health,
      spendingRate: health.income > 0 ? Math.round((health.expenses / health.income) * 100) : 0,
      expensesByType,
      projection: {
        isCurrentMonth,
        daysInMonth,
        dayOfMonth,
        daysRemaining: daysInMonth - dayOfMonth,
        projectedExpenses: Math.round(projectedExpenses),
        projectedBalance: Math.round(projectedBalance),
        projectedRealAvailable: Math.round(projectedBalance - health.upcomingObligations),
      },
    },
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
    insights: buildFinancialInsights({
      income,
      expenses,
      savingsRate: health.savingsRate,
      estimatedSavings: health.estimatedSavings,
      transactionCount: monthTransactions.length,
      expensesByCategory,
      remainingReservedBudget: health.remainingReservedBudget,
      upcomingObligations: health.upcomingObligations,
      realAvailable: health.realAvailable,
      totalOutstandingDebt: health.totalOutstandingDebt,
    }),
  };
}

function getExpensesByType(transactions: DashboardTransaction[]) {
  return transactions.reduce(
    (acc, tx) => {
      if (tx.type !== TransactionType.EXPENSE) return acc;
      const amount = toFiniteNumber(tx.amount);
      switch (tx.expenseType) {
        case "FIXED": acc.fixed += amount; break;
        case "VARIABLE": acc.variable += amount; break;
        case "EXTRAORDINARY": acc.extraordinary += amount; break;
        default: acc.unclassified += amount; break;
      }
      return acc;
    },
    { fixed: 0, variable: 0, extraordinary: 0, unclassified: 0 },
  );
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
  expensesByCategory: Array<{ id: string; name: string; value: number }>;
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

function buildFinancialInsights({
  income,
  expenses,
  savingsRate,
  estimatedSavings,
  transactionCount,
  expensesByCategory,
  remainingReservedBudget,
  upcomingObligations,
  realAvailable,
  totalOutstandingDebt,
}: {
  income: number;
  expenses: number;
  savingsRate: number;
  estimatedSavings: number;
  transactionCount: number;
  expensesByCategory: Array<{ id: string; name: string; value: number }>;
  remainingReservedBudget: number;
  upcomingObligations: number;
  realAvailable: number;
  totalOutstandingDebt: number;
}) {
  const insights: Array<{
    title: string;
    message: string;
    tone: "positive" | "warning" | "danger" | "default";
    actionLabel: string;
    href: string;
  }> = [];
  const topCategory = expensesByCategory[0];
  const spendingRatio = income > 0 ? expenses / income : 0;

  if (transactionCount === 0) {
    insights.push({
      title: "Empezá con el primer movimiento",
      message: "Registrá ingresos y gastos del mes para que el dashboard pueda darte consejos más precisos.",
      tone: "default",
      actionLabel: "Nueva transacción",
      href: "/transactions?new=1",
    });
  }

  if (realAvailable < 0) {
    insights.push({
      title: "Cuidá el disponible real",
      message: "Al descontar presupuestos pendientes y obligaciones próximas, el mes queda por debajo de cero.",
      tone: "danger",
      actionLabel: "Ver presupuestos",
      href: "/budgets",
    });
  } else if (realAvailable > 0 && upcomingObligations > 0) {
    insights.push({
      title: "Tenés margen después de obligaciones",
      message: "El disponible real ya contempla gastos recurrentes, metas, deuda y presupuestos pendientes.",
      tone: "positive",
      actionLabel: "Ver metas",
      href: "/goals",
    });
  }

  if (income > 0 && spendingRatio >= 0.8) {
    insights.push({
      title: "Los gastos están cerca del límite",
      message: "Conviene revisar compras variables antes de comprometer el cierre del mes.",
      tone: "warning",
      actionLabel: "Ver gastos",
      href: "/transactions?type=EXPENSE",
    });
  }

  if (income > 0 && savingsRate >= 20) {
    insights.push({
      title: "Buen ritmo de ahorro",
      message: "El balance mensual está dejando una proporción saludable para ahorro o reservas.",
      tone: "positive",
      actionLabel: "Planificar ahorro",
      href: "/goals",
    });
  } else if (estimatedSavings > 0) {
    insights.push({
      title: "Aprovechá el balance positivo",
      message: "Podés separar una parte del excedente para una meta antes de que se diluya en gastos chicos.",
      tone: "positive",
      actionLabel: "Crear meta",
      href: "/goals?new=1",
    });
  }

  if (topCategory && expenses > 0 && topCategory.value / expenses >= 0.4) {
    insights.push({
      title: `${topCategory.name} pesa fuerte este mes`,
      message: "Una sola categoría concentra gran parte de los gastos. Revisarla puede liberar margen rápido.",
      tone: "warning",
      actionLabel: "Analizar categoría",
      href: `/transactions?categoryId=${topCategory.id}`,
    });
  }

  if (remainingReservedBudget > 0) {
    insights.push({
      title: "Reservas todavía activas",
      message: "Hay presupuesto pendiente de usar; mantenerlo separado ayuda a no confundirlo con dinero libre.",
      tone: "default",
      actionLabel: "Ver presupuestos",
      href: "/budgets",
    });
  }

  if (totalOutstandingDebt > 0) {
    insights.push({
      title: "Seguimiento de deuda",
      message: "Revisar pagos mínimos y próximos vencimientos evita que la deuda compita con tus metas.",
      tone: "warning",
      actionLabel: "Ver deudas",
      href: "/debts",
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: "Mes bajo control",
      message: "No hay señales urgentes. Seguí registrando movimientos para mantener una lectura clara.",
      tone: "positive",
      actionLabel: "Ver transacciones",
      href: "/transactions",
    });
  }

  return insights.slice(0, 3);
}
