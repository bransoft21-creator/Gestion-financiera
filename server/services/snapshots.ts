import { CurrencyCode, DebtStatus, GoalStatus, TransactionOrigin, TransactionStatus, TransactionType } from "@prisma/client";
import { argentinaMonthRangeUtc } from "@/lib/dates";
import { prisma } from "../../lib/prisma";
import { assertHouseholdAccess } from "./households";
import { computeFinancialHealth, computeRealLiabilitySummary, toFiniteNumber } from "./financial-ledger";
import { traceFinancialSource } from "./financial-debug";
import { filterCurrency } from "@/lib/finance/currency-safe";

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
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const [household, monthTransactions, budgets, recurringExpenses, activeGoals, upcomingDebts, currentDebts, accounts, unpaidHouseholdRecurring] =
    await Promise.all([
      prisma.household.findUniqueOrThrow({
        where: { id: householdId },
        select: { defaultCurrency: true },
      }),
      prisma.transaction.findMany({
        where: {
          householdId,
          deletedAt: null,
          status: { not: TransactionStatus.CANCELED },
          occurredAt: { gte: monthStart, lt: nextMonthStart },
          type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
          NOT: [
            { origin: TransactionOrigin.CARD_SUMMARY },
            { type: TransactionType.EXPENSE, statementTransactions: { some: { deletedAt: null } } },
          ],
        },
        select: { type: true, currency: true, amount: true, categoryId: true },
      }),
      prisma.budget.findMany({
        where: { householdId, year, month, deletedAt: null },
        select: { categoryId: true, currency: true, plannedAmount: true },
      }),
      prisma.recurringExpense.findMany({
        where: {
          householdId,
          isActive: true,
          deletedAt: null,
          nextDueDate: { gte: monthStart, lt: nextMonthStart },
          OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
          occurrences: { none: { monthKey, status: "PAID" } },
        },
        select: { currency: true, amount: true },
      }),
      prisma.goal.findMany({
        where: {
          householdId,
          status: GoalStatus.ACTIVE,
          deletedAt: null,
          requiredMonthlyAmount: { not: null },
        },
        select: { currency: true, requiredMonthlyAmount: true },
      }),
      prisma.debt.findMany({
        where: {
          householdId,
          status: { in: [DebtStatus.ACTIVE, DebtStatus.DEFAULTED] },
          outstandingAmount: { gt: 0 },
          deletedAt: null,
          nextDueDate: { gte: monthStart, lt: nextMonthStart },
        },
        select: { currency: true, minimumPayment: true, outstandingAmount: true },
      }),
      prisma.debt.findMany({
        where: {
          householdId,
          status: { in: [DebtStatus.ACTIVE, DebtStatus.PAUSED, DebtStatus.DEFAULTED] },
          outstandingAmount: { gt: 0 },
          deletedAt: null,
        },
        select: { type: true, status: true, currency: true, outstandingAmount: true },
      }),
      prisma.account.findMany({
        where: { householdId, deletedAt: null, isArchived: false },
        select: { id: true, type: true, currency: true, currentBalance: true, isArchived: true, deletedAt: true },
      }),
      prisma.householdRecurringPayment.findMany({
        where: {
          householdId,
          isActive: true,
          deletedAt: null,
          occurrences: { none: { monthKey, status: "PAID" } },
        },
        select: { currency: true, estimatedAmount: true },
      }),
    ]);

  const currencies = new Set<CurrencyCode>([household.defaultCurrency]);
  for (const collection of [monthTransactions, budgets, recurringExpenses, activeGoals, upcomingDebts, currentDebts, accounts, unpaidHouseholdRecurring]) {
    for (const item of collection) currencies.add(item.currency);
  }

  const snapshots = [];
  for (const currency of currencies) {
    const currencyTransactions = filterCurrency(monthTransactions, currency, (transaction) => transaction.currency);
    const currencyBudgets = filterCurrency(budgets, currency, (budget) => budget.currency);
    const currencyRecurringExpenses = filterCurrency(recurringExpenses, currency, (expense) => expense.currency);
    const currencyActiveGoals = filterCurrency(activeGoals, currency, (goal) => goal.currency);
    const currencyUpcomingDebts = filterCurrency(upcomingDebts, currency, (debt) => debt.currency);
    const currencyCurrentDebts = filterCurrency(currentDebts, currency, (debt) => debt.currency);
    const currencyAccounts = filterCurrency(accounts, currency, (account) => account.currency);
    const currencyUnpaidHouseholdRecurring = filterCurrency(unpaidHouseholdRecurring, currency, (p) => p.currency);

    const income = currencyTransactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((s, t) => s + toFiniteNumber(t.amount), 0);
    const expenses = currencyTransactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((s, t) => s + toFiniteNumber(t.amount), 0);

    const expensesByCategoryId = new Map<string, number>();
    for (const t of currencyTransactions) {
      if (t.type === TransactionType.EXPENSE && t.categoryId) {
        expensesByCategoryId.set(
          t.categoryId,
          (expensesByCategoryId.get(t.categoryId) ?? 0) + toFiniteNumber(t.amount),
        );
      }
    }

    const liabilitySummary = computeRealLiabilitySummary(currencyAccounts, currencyCurrentDebts);
    traceFinancialSource({
      endpoint: "/api/snapshots POST",
      householdId,
      source: "captureMonthlySnapshot.debtOutstandingAmount <- computeRealLiabilitySummary.liabilities (currency scoped)",
      computed: {
        currency,
        debtOutstandingAmount: liabilitySummary.liabilities,
        accountLiabilities: liabilitySummary.accountLiabilities,
        debtLiabilities: liabilitySummary.debtLiabilities,
      },
      accounts: currencyAccounts.filter((account) => toFiniteNumber(account.currentBalance) < 0),
      debts: currencyCurrentDebts.map((debt, index) => ({ ...debt, id: `debt-${index}` })),
    });
    const health = computeFinancialHealth({
      income,
      expenses,
      budgets: currencyBudgets.map((b) => ({
        plannedAmount: b.plannedAmount,
        spentAmount: expensesByCategoryId.get(b.categoryId) ?? 0,
      })),
      recurringExpenses: [
        ...currencyRecurringExpenses,
        ...currencyUnpaidHouseholdRecurring.map((p) => ({ amount: p.estimatedAmount })),
      ],
      goals: currencyActiveGoals,
      debts: currencyUpcomingDebts,
      totalOutstandingDebt: liabilitySummary.liabilities,
    });

    snapshots.push(await prisma.monthlySnapshot.upsert({
      where: {
        householdId_currency_year_month: { householdId, currency, year, month },
      },
      create: {
        householdId,
        currency,
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
    }));
  }

  return snapshots;
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

  traceFinancialSource({
    endpoint: "/api/snapshots",
    householdId,
    source: "listMonthlySnapshots.debtOutstandingAmount",
    snapshots: rows,
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
