import { DebtStatus, GoalStatus, TransactionStatus, TransactionType } from "@prisma/client";
import { argentinaMonthRangeUtc } from "@/lib/dates";
import { prisma } from "../../lib/prisma";
import { assertHouseholdAccess } from "./households";
import { computeFinancialHealth, computeRealLiabilitySummary, toFiniteNumber } from "./financial-ledger";

export async function captureMonthlySnapshot(
  userProfileId: string,
  householdId: string,
  year: number,
  month: number,
) {
  await assertHouseholdAccess(userProfileId, householdId);

  // Solo captura meses pasados — el mes actual cambia constantemente
  const now = new Date();
  const isCurrentOrFuture =
    year > now.getFullYear() ||
    (year === now.getFullYear() && month >= now.getMonth() + 1);
  if (isCurrentOrFuture) return null;

  const { start: monthStart, end: nextMonthStart } = argentinaMonthRangeUtc(year, month);

  const [monthTransactions, budgets, recurringExpenses, activeGoals, upcomingDebts, currentDebts, accounts] =
    await Promise.all([
      prisma.transaction.findMany({
        where: {
          householdId,
          deletedAt: null,
          status: { not: TransactionStatus.CANCELED },
          occurredAt: { gte: monthStart, lt: nextMonthStart },
          type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
        },
        select: { type: true, amount: true, categoryId: true },
      }),
      prisma.budget.findMany({
        where: { householdId, year, month, deletedAt: null },
        select: { categoryId: true, plannedAmount: true },
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
          status: { in: [DebtStatus.ACTIVE, DebtStatus.DEFAULTED] },
          outstandingAmount: { gt: 0 },
          deletedAt: null,
          nextDueDate: { gte: monthStart, lt: nextMonthStart },
        },
        select: { minimumPayment: true, outstandingAmount: true },
      }),
      prisma.debt.findMany({
        where: {
          householdId,
          status: { in: [DebtStatus.ACTIVE, DebtStatus.PAUSED, DebtStatus.DEFAULTED] },
          outstandingAmount: { gt: 0 },
          deletedAt: null,
        },
        select: { type: true, status: true, outstandingAmount: true },
      }),
      prisma.account.findMany({
        where: { householdId, deletedAt: null, isArchived: false },
        select: { type: true, currentBalance: true, isArchived: true, deletedAt: true },
      }),
    ]);

  const income = monthTransactions
    .filter((t) => t.type === TransactionType.INCOME)
    .reduce((s, t) => s + toFiniteNumber(t.amount), 0);
  const expenses = monthTransactions
    .filter((t) => t.type === TransactionType.EXPENSE)
    .reduce((s, t) => s + toFiniteNumber(t.amount), 0);

  const expensesByCategoryId = new Map<string, number>();
  for (const t of monthTransactions) {
    if (t.type === TransactionType.EXPENSE && t.categoryId) {
      expensesByCategoryId.set(
        t.categoryId,
        (expensesByCategoryId.get(t.categoryId) ?? 0) + toFiniteNumber(t.amount),
      );
    }
  }

  const liabilitySummary = computeRealLiabilitySummary(accounts, currentDebts);
  const health = computeFinancialHealth({
    income,
    expenses,
    budgets: budgets.map((b) => ({
      plannedAmount: b.plannedAmount,
      spentAmount: expensesByCategoryId.get(b.categoryId) ?? 0,
    })),
    recurringExpenses,
    goals: activeGoals,
    debts: upcomingDebts,
    totalOutstandingDebt: liabilitySummary.liabilities,
  });

  return prisma.monthlySnapshot.upsert({
    where: {
      householdId_currency_year_month: { householdId, currency: "ARS", year, month },
    },
    create: {
      householdId,
      currency: "ARS",
      year,
      month,
      incomeAmount: health.income,
      expenseAmount: health.expenses,
      reservedAmount: health.remainingReservedBudget,
      goalAllocatedAmount: health.requiredGoalContributions,
      debtOutstandingAmount: health.totalOutstandingDebt,
      upcomingObligationsAmount: health.upcomingObligations,
      availableAmount: health.realAvailable,
    },
    update: {
      incomeAmount: health.income,
      expenseAmount: health.expenses,
      reservedAmount: health.remainingReservedBudget,
      goalAllocatedAmount: health.requiredGoalContributions,
      debtOutstandingAmount: health.totalOutstandingDebt,
      upcomingObligationsAmount: health.upcomingObligations,
      availableAmount: health.realAvailable,
    },
  });
}

export async function listMonthlySnapshots(
  userProfileId: string,
  householdId: string,
  limit = 12,
) {
  await assertHouseholdAccess(userProfileId, householdId);

  const rows = await prisma.monthlySnapshot.findMany({
    where: { householdId, deletedAt: null },
    orderBy: [{ year: "asc" }, { month: "asc" }],
    take: limit,
    select: {
      id: true,
      year: true,
      month: true,
      currency: true,
      incomeAmount: true,
      expenseAmount: true,
      reservedAmount: true,
      goalAllocatedAmount: true,
      debtOutstandingAmount: true,
      upcomingObligationsAmount: true,
      availableAmount: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    year: r.year,
    month: r.month,
    currency: r.currency,
    incomeAmount: toFiniteNumber(r.incomeAmount),
    expenseAmount: toFiniteNumber(r.expenseAmount),
    reservedAmount: toFiniteNumber(r.reservedAmount),
    goalAllocatedAmount: toFiniteNumber(r.goalAllocatedAmount),
    debtOutstandingAmount: toFiniteNumber(r.debtOutstandingAmount),
    upcomingObligationsAmount: toFiniteNumber(r.upcomingObligationsAmount),
    availableAmount: toFiniteNumber(r.availableAmount),
  }));
}
