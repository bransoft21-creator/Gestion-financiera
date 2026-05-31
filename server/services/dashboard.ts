import { AccountType, AgreementDirection, AgreementStatus, CardStatementStatus, DebtStatus, DebtType, GoalStatus, HouseholdKind, HouseholdMemberStatus, Prisma, TransactionOrigin, TransactionStatus, TransactionType } from "@prisma/client";
import { argentinaMonthRangeUtc, formatArgentinaDateInput } from "@/lib/dates";
import { isSmartImportEnabled } from "@/lib/feature-flags";
import { prisma } from "../../lib/prisma";
import { computeFinancialHealth, computeRealLiabilitySummary, toFiniteNumber } from "./financial-ledger";
import { traceFinancialSource } from "./financial-debug";
import { assertHouseholdAccess } from "./households";
import { normalizeOnboardingGoals } from "../schemas/onboarding";
import { buildNextStepRecommendation } from "./next-step-engine";
import { EMPTY_NAVIGATION_AWARENESS } from "@/lib/navigation-awareness";
import { getNavigationAwareness } from "./navigation-awareness";
import { filterCurrency, sumByCurrency } from "@/lib/finance/currency-safe";
import { syncLegacyCreditCards } from "./credit-cards";

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
  await syncLegacyCreditCards(userProfileId, householdId);

  const { start: monthStart, end: nextMonthStart } = argentinaMonthRangeUtc(year, month);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  const argDateStr = formatArgentinaDateInput();
  const [argYear, argMonth] = argDateStr.split("-").map(Number);
  const isCurrentOrFutureMonth = year > argYear || (year === argYear && month >= argMonth);

  const [
    monthTransactions,
    latestTransactions,
    budgets,
    currentDebts,
    recurringExpenses,
    activeGoals,
    upcomingDebts,
    accounts,
    profile,
    totalTransactionCount,
    budgetCount,
    recurringExpenseCount,
    sharedHouseholdCount,
    household,
    activeAgreements,
    unpaidHouseholdRecurring,
    cardStatementsDue,
    openCardMovements,
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        householdId,
        ...activeTransactionWhere,
        occurredAt: { gte: monthStart, lt: nextMonthStart },
        // CARD_PAYMENT = actual cash out when paying the CC bill. Must be included so
        // the cash outflow registers in P&L even though the purchase (CARD_SUMMARY) is excluded.
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.CARD_PAYMENT] },
        // Exclude CC purchase imports from P&L. Two discriminators cover all cases:
        // 1. origin=CARD_SUMMARY: imports done before StatementTransaction links existed.
        // 2. hasStatementTransaction: current imports linked to a statement.
        // Manually-entered CC expenses (origin≠CARD_SUMMARY, no link) stay in P&L.
        NOT: [
          { origin: TransactionOrigin.CARD_SUMMARY },
          { type: TransactionType.EXPENSE, statementTransactions: { some: { deletedAt: null } } },
        ],
      },
      include: dashboardTransactionInclude,
      orderBy: { occurredAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: {
        householdId,
        ...activeTransactionWhere,
        occurredAt: { gte: monthStart, lt: nextMonthStart },
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.CARD_PAYMENT] },
        NOT: [
          { origin: TransactionOrigin.CARD_SUMMARY },
          { type: TransactionType.EXPENSE, statementTransactions: { some: { deletedAt: null } } },
        ],
      },
      include: dashboardTransactionInclude,
      orderBy: { occurredAt: "desc" },
      take: 5,
    }),
    prisma.budget.findMany({
      where: { householdId, year, month, deletedAt: null },
      select: { categoryId: true, currency: true, plannedAmount: true },
    }),
    prisma.debt.findMany({
      where: {
        householdId,
        status: { in: [DebtStatus.ACTIVE, DebtStatus.PAUSED, DebtStatus.DEFAULTED] },
        outstandingAmount: { gt: 0 },
        deletedAt: null,
      },
      select: { id: true, type: true, status: true, currency: true, outstandingAmount: true },
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
      select: { type: true, currency: true, minimumPayment: true, outstandingAmount: true },
    }),
    prisma.account.findMany({
      where: { householdId, deletedAt: null, isArchived: false },
      select: { id: true, type: true, currency: true, currentBalance: true, isArchived: true, deletedAt: true },
    }),
    prisma.userProfile.findUniqueOrThrow({
      where: { id: userProfileId },
      select: { email: true, onboardingGoals: true, onboardingCompletedAt: true },
    }),
    prisma.transaction.count({
      where: {
        householdId,
        ...activeTransactionWhere,
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
      },
    }),
    prisma.budget.count({
      where: { householdId, deletedAt: null },
    }),
    prisma.recurringExpense.count({
      where: { householdId, isActive: true, deletedAt: null },
    }),
    prisma.household.count({
      where: {
        kind: HouseholdKind.HOUSEHOLD,
        deletedAt: null,
        members: {
          some: {
            userProfileId,
            status: HouseholdMemberStatus.ACTIVE,
            deletedAt: null,
          },
        },
      },
    }),
    prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { defaultCurrency: true },
    }),
    prisma.personalAgreement.findMany({
      where: {
        householdId,
        deletedAt: null,
        status: { in: [AgreementStatus.OPEN, AgreementStatus.PARTIAL, AgreementStatus.OVERDUE] },
      },
      select: { direction: true, currentBalance: true, currency: true, status: true },
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
    // Past-month views are retrospective: CC obligations don't surface there because
    // the user can't act on them and they distort the historical P&L. Obligations
    // only appear in the current month (due this month + overdue) and future months
    // (due that month), where the user needs to plan or take action.
    isCurrentOrFutureMonth
      ? prisma.cardStatement.findMany({
          where: {
            householdId,
            deletedAt: null,
            status: {
              in: [
                CardStatementStatus.CLOSED_PENDING_PAYMENT,
                CardStatementStatus.PARTIALLY_PAID,
                CardStatementStatus.OVERDUE,
              ],
            },
            pendingAmount: { gt: 0 },
            OR: [
              { dueDate: { gte: monthStart, lt: nextMonthStart } },
              { status: CardStatementStatus.OVERDUE },
            ],
          },
          select: {
            currency: true,
            pendingAmount: true,
            minimumPayment: true,
          },
        })
      : Promise.resolve([]),
    // Purchases linked to OPEN CC statements (pendingAmount is 0 on OPEN statements, so we
    // sum StatementTransactions directly to capture the true obligation for the current month).
    isCurrentOrFutureMonth
      ? prisma.statementTransaction.findMany({
          where: {
            householdId,
            deletedAt: null,
            statement: {
              householdId,
              deletedAt: null,
              status: CardStatementStatus.OPEN,
            },
          },
          select: { currency: true, amount: true },
        })
      : Promise.resolve([]),
  ]);

  const primaryCurrency = household.defaultCurrency;

  const primaryActiveAgreements = activeAgreements.filter((a) => a.currency === primaryCurrency);
  const interpersonalPosition = primaryActiveAgreements.reduce(
    (acc, a) => {
      const balance = toFiniteNumber(a.currentBalance);
      if (a.direction === AgreementDirection.LENT || a.direction === AgreementDirection.SHARED) {
        acc.toReceive += balance;
      } else {
        acc.toPay += balance;
      }
      if (a.status === AgreementStatus.OVERDUE) acc.overdueCount += 1;
      return acc;
    },
    { toReceive: 0, toPay: 0, overdueCount: 0, currency: primaryCurrency },
  );
  const primaryMonthTransactions = filterCurrency(monthTransactions, primaryCurrency, (transaction) => transaction.currency);
  const primaryBudgets = filterCurrency(budgets, primaryCurrency, (budget) => budget.currency);
  const primaryRecurringExpenses = filterCurrency(recurringExpenses, primaryCurrency, (expense) => expense.currency);
  const primaryActiveGoals = filterCurrency(activeGoals, primaryCurrency, (goal) => goal.currency);
  const primaryUpcomingDebts = filterCurrency(upcomingDebts, primaryCurrency, (debt) => debt.currency);
  const primaryUpcomingNonCardDebts = primaryUpcomingDebts.filter((debt) => debt.type !== DebtType.CREDIT_CARD);
  const primaryCardStatementsDue = filterCurrency(cardStatementsDue, primaryCurrency, (statement) => statement.currency);
  const primaryOpenCardMovements = filterCurrency(openCardMovements, primaryCurrency, (m) => m.currency);
  const openStatementTotal = primaryOpenCardMovements.reduce((sum, m) => sum + toFiniteNumber(m.amount), 0);
  const primaryCurrentDebts = filterCurrency(currentDebts, primaryCurrency, (debt) => debt.currency);
  const primaryAccounts = filterCurrency(accounts, primaryCurrency, (account) => account.currency);
  const primaryUnpaidHouseholdRecurring = filterCurrency(
    unpaidHouseholdRecurring,
    primaryCurrency,
    (p) => p.currency,
  );
  const transactionTotalsByCurrency = sumByCurrency(
    monthTransactions,
    (transaction) => transaction.currency,
    (transaction) => transaction.amount,
  );

  const income = sumTransactionsByType(primaryMonthTransactions, TransactionType.INCOME);
  const expenses = sumTransactionsByType(primaryMonthTransactions, TransactionType.EXPENSE);
  const expensesByCategory = getExpensesByCategory(primaryMonthTransactions);
  const expenseCategoryDetails = getExpenseCategoryDetails(primaryMonthTransactions);
  const expensesByType = getExpensesByType(primaryMonthTransactions);
  const expensesByCategoryId = getExpenseTotalsByCategoryId(primaryMonthTransactions);
  const fixedToIncomeRatio = income > 0 ? Math.round((expensesByType.fixed / income) * 100) : 0;
  const liabilitySummary = computeRealLiabilitySummary(primaryAccounts, primaryCurrentDebts);
  traceFinancialSource({
    endpoint: "/api/dashboard/summary",
    householdId,
    source: "metrics.totalOutstandingDebt <- computeRealLiabilitySummary.liabilities (primary currency only)",
    computed: {
      currency: primaryCurrency,
      accountLiabilities: liabilitySummary.accountLiabilities,
      debtLiabilities: liabilitySummary.debtLiabilities,
      duplicatedCreditCardDebt: liabilitySummary.duplicatedCreditCardDebt,
      totalOutstandingDebt: liabilitySummary.liabilities,
    },
    accounts: primaryAccounts.filter((account) => toFiniteNumber(account.currentBalance) < 0),
    debts: primaryCurrentDebts,
  });
  const health = computeFinancialHealth({
    income,
    expenses,
    budgets: primaryBudgets.map((budget) => ({
      plannedAmount: budget.plannedAmount,
      spentAmount: expensesByCategoryId.get(budget.categoryId) ?? 0,
    })),
    recurringExpenses: [
      ...primaryRecurringExpenses,
      ...primaryUnpaidHouseholdRecurring.map((p) => ({ amount: p.estimatedAmount })),
    ],
    goals: primaryActiveGoals,
    debts: [
      ...primaryUpcomingNonCardDebts,
      ...primaryCardStatementsDue.map((statement) => ({
        minimumPayment: statement.minimumPayment,
        outstandingAmount: statement.pendingAmount,
      })),
      // OPEN statement purchases: pendingAmount is always 0 on OPEN statements, so we use the
      // movement total (sum of linked StatementTransactions) as the upcoming obligation.
      ...(openStatementTotal > 0 ? [{ minimumPayment: null, outstandingAmount: openStatementTotal }] : []),
    ],
    totalOutstandingDebt: liabilitySummary.liabilities,
    interpersonalToPay: interpersonalPosition.toPay,
  });

  const [, , argDay] = argDateStr.split("-").map(Number);
  const isCurrentMonth = argYear === year && argMonth === month;
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayOfMonth = isCurrentMonth ? argDay : daysInMonth;
  const daysRemaining = daysInMonth - dayOfMonth;

  // Split expenses by projectability:
  // - fixed + extraordinary are one-time payments (rent, cards, services, vacation).
  //   Multiplying them by remaining days would grossly overstate the forecast.
  // - variable + unclassified represent daily flow and are projected linearly.
  const nonDailySpent = expensesByType.fixed + expensesByType.extraordinary;
  const dailySpent = expensesByType.variable + expensesByType.unclassified;
  const dailyEstimated = dayOfMonth > 0 && daysRemaining > 0
    ? (dailySpent / dayOfMonth) * daysRemaining
    : 0;

  const projectedExpenses = Math.round(nonDailySpent + dailySpent + dailyEstimated);
  const projectedBalance = Math.round(income - projectedExpenses);

  // Confidence level: how reliable is this estimate?
  type ProjectionConfidence = "high" | "medium" | "low";
  let projectionConfidence: ProjectionConfidence;
  let projectionNote: string;

  if (!isCurrentMonth) {
    projectionConfidence = "high";
    projectionNote = "";
  } else if (dayOfMonth < 3) {
    projectionConfidence = "low";
    projectionNote = "Inicio del mes: pocos días para estimar el flujo variable.";
  } else if (dailySpent === 0) {
    projectionConfidence = "low";
    projectionNote = "Solo pagos únicos registrados. Falta flujo diario para proyectar.";
  } else if (dayOfMonth >= 7 && (budgets.length > 0 || dayOfMonth >= 14)) {
    projectionConfidence = "high";
    projectionNote = nonDailySpent > 0
      ? "Gastos fijos y extraordinarios no se proyectan diariamente."
      : "Proyección basada en el flujo variable del mes.";
  } else {
    projectionConfidence = "medium";
    projectionNote = "Estimación en progreso. Más días registrados mejoran la precisión.";
  }

  return {
    period: {
      year,
      month,
      from: monthStart.toISOString(),
      to: nextMonthStart.toISOString(),
    },
    metrics: {
      ...health,
      currency: primaryCurrency,
      currencyScope: {
        primaryCurrency,
        totalsByCurrency: transactionTotalsByCurrency,
        ignoredCurrencies: transactionTotalsByCurrency
          .filter((total) => total.currency !== primaryCurrency && total.count > 0)
          .map((total) => total.currency),
        mixedCurrencies: transactionTotalsByCurrency.filter((total) => total.count > 0).length > 1,
      },
      spendingRate: health.income > 0 ? Math.round((health.expenses / health.income) * 100) : 0,
      expensesByType,
      fixedToIncomeRatio,
      projection: {
        isCurrentMonth,
        daysInMonth,
        dayOfMonth,
        daysRemaining,
        projectedExpenses,
        projectedBalance,
        projectedRealAvailable: Math.round(projectedBalance - health.upcomingObligations),
        confidence: projectionConfidence,
        confidenceNote: projectionNote,
        hasEarlyLargeFixed: isCurrentMonth && nonDailySpent > 0 && dayOfMonth <= 7,
      },
      accountBalances: getAccountBalancesByCurrency(accounts),
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
      fixedToIncomeRatio,
    }),
    activation: buildNextStepRecommendation({
      onboardingGoals: normalizeOnboardingGoals(profile.onboardingGoals),
      hasAccounts: accounts.length > 0,
      hasTransactions: totalTransactionCount > 0,
      hasSharedHousehold: sharedHouseholdCount > 0,
      hasBudgets: budgetCount > 0,
      hasRecurringExpenses: recurringExpenseCount > 0,
      hasActiveDebts: currentDebts.length > 0,
      canSmartImport: isSmartImportEnabled(profile.email),
      onboardingCompletedAt: profile.onboardingCompletedAt,
    }),
    awareness: await getNavigationAwareness(userProfileId).catch(() => EMPTY_NAVIGATION_AWARENESS),
    interpersonalPosition,
  };
}

function getExpensesByType(transactions: DashboardTransaction[]) {
  return transactions.reduce(
    (acc, tx) => {
      if (tx.type !== TransactionType.EXPENSE && tx.type !== TransactionType.CARD_PAYMENT) return acc;
      const amount = toFiniteNumber(tx.amount);
      if (tx.type === TransactionType.CARD_PAYMENT) {
        acc.fixed += amount; // CC bill payments are fixed obligations
        return acc;
      }
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

function getAccountBalancesByCurrency(
  accounts: Array<{ currency: string; currentBalance: Prisma.Decimal | number }>,
) {
  const totals = accounts.reduce((acc, account) => {
    const current = acc.get(account.currency) ?? { currency: account.currency, amount: 0, accountCount: 0 };
    current.amount += toFiniteNumber(account.currentBalance);
    current.accountCount += 1;
    acc.set(account.currency, current);
    return acc;
  }, new Map<string, { currency: string; amount: number; accountCount: number }>());

  return Array.from(totals.values()).sort((a, b) => a.currency.localeCompare(b.currency));
}

function getExpenseTotalsByCategoryId(transactions: DashboardTransaction[]) {
  return transactions.reduce((totals, transaction) => {
    // CARD_PAYMENT has no categoryId — doesn't affect budget reservations
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
    const matches =
      transaction.type === type ||
      // CARD_PAYMENT counts as EXPENSE: it's the actual cash outflow when paying the CC bill
      (type === TransactionType.EXPENSE && transaction.type === TransactionType.CARD_PAYMENT);
    return matches ? total + toFiniteNumber(transaction.amount) : total;
  }, 0);
}

const CARD_PAYMENT_CATEGORY_KEY = "card-payment";
const CARD_PAYMENT_CATEGORY_NAME = "Pago de tarjeta";
const CARD_PAYMENT_CATEGORY_COLOR = "#64748b";

function getExpensesByCategory(transactions: DashboardTransaction[]) {
  const totals = new Map<string, { id: string; name: string; value: number; color: string }>();

  transactions.forEach((transaction) => {
    if (transaction.type !== TransactionType.EXPENSE && transaction.type !== TransactionType.CARD_PAYMENT) {
      return;
    }

    const isCardPayment = transaction.type === TransactionType.CARD_PAYMENT;
    const key = isCardPayment ? CARD_PAYMENT_CATEGORY_KEY : (transaction.category?.id ?? "uncategorized");
    const existing = totals.get(key);
    const nextValue = (existing?.value ?? 0) + toFiniteNumber(transaction.amount);

    totals.set(key, {
      id: key,
      name: isCardPayment ? CARD_PAYMENT_CATEGORY_NAME : (transaction.category?.name ?? "Sin categoría"),
      value: nextValue,
      color: isCardPayment ? CARD_PAYMENT_CATEGORY_COLOR : (transaction.category?.color ?? chartColors[totals.size % chartColors.length]),
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
    if (transaction.type !== TransactionType.EXPENSE && transaction.type !== TransactionType.CARD_PAYMENT) {
      return;
    }

    const isCardPayment = transaction.type === TransactionType.CARD_PAYMENT;
    const key = isCardPayment ? CARD_PAYMENT_CATEGORY_KEY : (transaction.category?.id ?? "uncategorized");
    const amount = toFiniteNumber(transaction.amount);
    const existing = details.get(key);

    details.set(key, {
      id: key,
      name: isCardPayment ? CARD_PAYMENT_CATEGORY_NAME : (transaction.category?.name ?? "Sin categoría"),
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
  fixedToIncomeRatio,
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
  fixedToIncomeRatio: number;
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
      message: "El disponible real ya contempla gastos recurrentes, metas, créditos y presupuestos pendientes.",
      tone: "positive",
      actionLabel: "Ver metas",
      href: "/goals",
    });
  }

  if (income > 0 && fixedToIncomeRatio >= 60) {
    insights.push({
      title: `Gastos fijos muy altos: ${fixedToIncomeRatio}% de ingresos`,
      message: "Más de la mitad del ingreso ya está comprometido en obligaciones fijas. El margen para imprevistos es muy ajustado.",
      tone: "danger",
      actionLabel: "Ver gastos",
      href: "/transactions?type=EXPENSE",
    });
  } else if (income > 0 && fixedToIncomeRatio >= 40) {
    insights.push({
      title: `Gastos fijos: ${fixedToIncomeRatio}% de ingresos`,
      message: "Los compromisos fijos son elevados. Idealmente deberían mantenerse por debajo del 50% del ingreso.",
      tone: "warning",
      actionLabel: "Ver gastos",
      href: "/transactions?type=EXPENSE",
    });
  } else if (income > 0 && fixedToIncomeRatio > 0 && fixedToIncomeRatio < 40) {
    insights.push({
      title: `Gastos fijos saludables: ${fixedToIncomeRatio}% de ingresos`,
      message: "Los compromisos fijos dejan buen margen para gastos variables y ahorro.",
      tone: "positive",
      actionLabel: "Ver transacciones",
      href: "/transactions?type=EXPENSE",
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
      title: "Seguimiento de créditos y cuotas",
      message: "Revisar pagos mínimos y próximos vencimientos evita que los compromisos formales compitan con tus metas.",
      tone: "warning",
      actionLabel: "Ver créditos",
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
