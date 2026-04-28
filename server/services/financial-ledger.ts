import {
  AccountType,
  DebtStatus,
  GoalStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";

export type BalanceDelta = { accountId: string; delta: number }[];

export type LinkedEntityEffects = {
  debtId: string | null;
  debtDelta: number;
  goalId: string | null;
  goalDelta: number;
};

const NO_LINKED_ENTITY_EFFECTS: LinkedEntityEffects = {
  debtId: null,
  debtDelta: 0,
  goalId: null,
  goalDelta: 0,
};

type BalanceInput = {
  type: TransactionType;
  status: TransactionStatus;
  accountId: string;
  transferAccountId?: string | null;
  amount: Prisma.Decimal | number;
  transferAmount?: Prisma.Decimal | number | null;
};

type LinkedEntityInput = {
  type: TransactionType;
  status: TransactionStatus;
  debtId?: string | null;
  goalId?: string | null;
  amount: Prisma.Decimal | number;
};

type AccountSummaryInput = {
  type: AccountType;
  currentBalance: Prisma.Decimal | number;
  isArchived: boolean;
  deletedAt?: Date | null;
};

type AvailableMoneyInput = {
  income: number;
  expenses: number;
  reservedBudget: number;
  recurringExpenses: number;
  requiredGoalContributions: number;
  debtPayments: number;
};

type BudgetReservationInput = {
  plannedAmount: Prisma.Decimal | number;
  spentAmount: Prisma.Decimal | number;
};

type MonthlyDebtPaymentInput = {
  minimumPayment: Prisma.Decimal | number | null;
  outstandingAmount: Prisma.Decimal | number;
};

type DebtPaymentResultInput = {
  originalAmount: Prisma.Decimal | number;
  outstandingAmount: Prisma.Decimal | number;
  paymentAmount: Prisma.Decimal | number;
};

type FinancialHealthInput = {
  income: number;
  expenses: number;
  budgets: BudgetReservationInput[];
  recurringExpenses: Array<{ amount: Prisma.Decimal | number }>;
  goals: Array<{ requiredMonthlyAmount: Prisma.Decimal | number | null }>;
  debts: MonthlyDebtPaymentInput[];
  totalOutstandingDebt: Prisma.Decimal | number;
};

// Ledger convention: account balances are signed. Credit-card debt is negative,
// and a payment transfer increases the card balance toward zero.
export function computeTransactionBalanceDeltas(transaction: BalanceInput): BalanceDelta {
  if (transaction.status === TransactionStatus.CANCELED) return [];

  const amount = toFiniteNumber(transaction.amount);
  const transferAmount =
    transaction.transferAmount != null ? toFiniteNumber(transaction.transferAmount) : amount;

  switch (transaction.type) {
    case TransactionType.INCOME:
    case TransactionType.ADJUSTMENT:
      return [{ accountId: transaction.accountId, delta: amount }];

    case TransactionType.EXPENSE:
    case TransactionType.DEBT_PAYMENT:
    case TransactionType.GOAL_CONTRIBUTION:
    case TransactionType.INVESTMENT:
      return [{ accountId: transaction.accountId, delta: -amount }];

    case TransactionType.TRANSFER:
      if (!transaction.transferAccountId) {
        return [{ accountId: transaction.accountId, delta: -amount }];
      }

      return [
        { accountId: transaction.accountId, delta: -amount },
        { accountId: transaction.transferAccountId, delta: transferAmount },
      ];

    default:
      return [];
  }
}

export async function applyBalanceDeltas(
  tx: Prisma.TransactionClient,
  deltas: BalanceDelta,
): Promise<void> {
  for (const { accountId, delta } of deltas) {
    await tx.account.update({
      where: { id: accountId },
      data: { currentBalance: { increment: delta } },
    });
  }
}

export function reverseBalanceDeltas(deltas: BalanceDelta): BalanceDelta {
  return deltas.map((delta) => ({ ...delta, delta: -delta.delta }));
}

export function computeTransactionLinkedEntityEffects(
  transaction: LinkedEntityInput,
): LinkedEntityEffects {
  if (transaction.status === TransactionStatus.CANCELED) {
    return NO_LINKED_ENTITY_EFFECTS;
  }

  const amount = toFiniteNumber(transaction.amount);

  if (transaction.type === TransactionType.DEBT_PAYMENT && transaction.debtId) {
    return { ...NO_LINKED_ENTITY_EFFECTS, debtId: transaction.debtId, debtDelta: -amount };
  }

  if (transaction.type === TransactionType.GOAL_CONTRIBUTION && transaction.goalId) {
    return { ...NO_LINKED_ENTITY_EFFECTS, goalId: transaction.goalId, goalDelta: amount };
  }

  return NO_LINKED_ENTITY_EFFECTS;
}

export function reverseLinkedEntityEffects(effects: LinkedEntityEffects): LinkedEntityEffects {
  return {
    debtId: effects.debtId,
    debtDelta: -effects.debtDelta,
    goalId: effects.goalId,
    goalDelta: -effects.goalDelta,
  };
}

export async function applyLinkedEntityEffects(
  tx: Prisma.TransactionClient,
  effects: LinkedEntityEffects,
): Promise<void> {
  if (effects.debtId && effects.debtDelta !== 0) {
    await applyDebtDelta(tx, effects.debtId, effects.debtDelta);
  }

  if (effects.goalId && effects.goalDelta !== 0) {
    await applyGoalDelta(tx, effects.goalId, effects.goalDelta);
  }
}

export function computeAccountSummary(accounts: AccountSummaryInput[]) {
  const activeBalances = accounts
    .filter((account) => !account.isArchived && !account.deletedAt)
    .map((account) => toFiniteNumber(account.currentBalance));

  const assets = activeBalances
    .filter((balance) => balance > 0)
    .reduce((sum, balance) => sum + balance, 0);

  const liabilities = activeBalances
    .filter((balance) => balance < 0)
    .reduce((sum, balance) => sum + Math.abs(balance), 0);

  return {
    assets,
    liabilities,
    netWorth: activeBalances.reduce((sum, balance) => sum + balance, 0),
  };
}

export function computeAvailableMoney(input: AvailableMoneyInput) {
  const balance = input.income - input.expenses;
  const upcomingObligations =
    input.recurringExpenses + input.requiredGoalContributions + input.debtPayments;

  return {
    balance,
    upcomingObligations,
    realAvailable: balance - input.reservedBudget - upcomingObligations,
  };
}

export function computeBudgetReservation(input: BudgetReservationInput) {
  return Math.max(toFiniteNumber(input.plannedAmount) - toFiniteNumber(input.spentAmount), 0);
}

export function computeMonthlyDebtPayment(input: MonthlyDebtPaymentInput) {
  return Math.min(
    toFiniteNumber(input.minimumPayment ?? input.outstandingAmount),
    toFiniteNumber(input.outstandingAmount),
  );
}

export function computeDebtPaymentResult(input: DebtPaymentResultInput) {
  const originalAmount = toFiniteNumber(input.originalAmount);
  const outstandingAmount = toFiniteNumber(input.outstandingAmount);
  const paymentAmount = toFiniteNumber(input.paymentAmount);
  const nextOutstandingAmount = Math.max(outstandingAmount - paymentAmount, 0);
  const paidAmount = Math.max(originalAmount - nextOutstandingAmount, 0);

  return {
    outstandingAmount: nextOutstandingAmount,
    paidPercent: originalAmount > 0 ? Math.min((paidAmount / originalAmount) * 100, 100) : 0,
    isPaid: nextOutstandingAmount === 0,
  };
}

export function getDebtPaymentAmountError(
  paymentAmount: Prisma.Decimal | number,
  outstandingAmount: Prisma.Decimal | number,
) {
  const amount = toFiniteNumber(paymentAmount);
  const outstanding = toFiniteNumber(outstandingAmount);

  if (amount <= 0) {
    return "Ingresá un monto mayor a cero.";
  }

  if (amount > outstanding) {
    return `El pago no puede superar el saldo pendiente (${outstanding.toFixed(2)}).`;
  }

  return null;
}

// Official dashboard formula:
// income/expenses = confirmed, non-deleted income and expense transactions in the selected month.
// reserved budget = sum of max(planned budget - spent in that budget category, 0).
// obligations = active recurring expenses due this month + active goal monthly contributions + active debt payments due this month.
// real available = income - expenses - reserved budget - obligations.
// savings rate = max(income - expenses, 0) / income.
// total debt = active outstanding debt, independent from this month's minimum payments.
export function computeFinancialHealth(input: FinancialHealthInput) {
  const balance = input.income - input.expenses;
  const reservedBudget = input.budgets.reduce(
    (sum, budget) => sum + computeBudgetReservation(budget),
    0,
  );
  const recurringExpenses = input.recurringExpenses.reduce(
    (sum, item) => sum + toFiniteNumber(item.amount),
    0,
  );
  const requiredGoalContributions = input.goals.reduce(
    (sum, goal) => sum + toFiniteNumber(goal.requiredMonthlyAmount ?? 0),
    0,
  );
  const debtPayments = input.debts.reduce(
    (sum, debt) => sum + computeMonthlyDebtPayment(debt),
    0,
  );
  const availableMoney = computeAvailableMoney({
    income: input.income,
    expenses: input.expenses,
    reservedBudget,
    recurringExpenses,
    requiredGoalContributions,
    debtPayments,
  });

  return {
    income: input.income,
    expenses: input.expenses,
    balance,
    estimatedSavings: Math.max(balance, 0),
    savingsRate: input.income > 0 ? Math.round((Math.max(balance, 0) / input.income) * 100) : 0,
    totalBudgeted: input.budgets.reduce((sum, budget) => sum + toFiniteNumber(budget.plannedAmount), 0),
    budgetedSpent: input.budgets.reduce((sum, budget) => sum + toFiniteNumber(budget.spentAmount), 0),
    remainingReservedBudget: reservedBudget,
    upcomingRecurringExpenses: recurringExpenses,
    requiredGoalContributions,
    upcomingDebtPayments: debtPayments,
    upcomingObligations: availableMoney.upcomingObligations,
    realAvailable: availableMoney.realAvailable,
    totalOutstandingDebt: toFiniteNumber(input.totalOutstandingDebt),
  };
}

export function toFiniteNumber(value: Prisma.Decimal | number) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

async function applyDebtDelta(
  tx: Prisma.TransactionClient,
  debtId: string,
  delta: number,
): Promise<void> {
  const debt = await tx.debt.findFirst({
    where: { id: debtId, deletedAt: null },
    select: { originalAmount: true, outstandingAmount: true, status: true },
  });

  if (!debt) return;

  const newOutstanding =
    delta < 0
      ? computeDebtPaymentResult({
          originalAmount: debt.originalAmount,
          outstandingAmount: debt.outstandingAmount,
          paymentAmount: Math.abs(delta),
        }).outstandingAmount
      : toFiniteNumber(debt.outstandingAmount) + delta;

  await tx.debt.update({
    where: { id: debtId },
    data: {
      outstandingAmount: newOutstanding,
      ...(newOutstanding === 0
        ? { status: DebtStatus.PAID }
        : debt.status === DebtStatus.PAID
        ? { status: DebtStatus.ACTIVE }
        : {}),
    },
  });
}

async function applyGoalDelta(
  tx: Prisma.TransactionClient,
  goalId: string,
  delta: number,
): Promise<void> {
  const goal = await tx.goal.findFirst({
    where: { id: goalId, deletedAt: null },
    select: { currentAmount: true, targetAmount: true, status: true },
  });

  if (!goal) return;

  const newCurrent = Math.max(0, toFiniteNumber(goal.currentAmount) + delta);
  const target = toFiniteNumber(goal.targetAmount);

  await tx.goal.update({
    where: { id: goalId },
    data: {
      currentAmount: newCurrent,
      ...(newCurrent >= target
        ? { status: GoalStatus.COMPLETED }
        : goal.status === GoalStatus.COMPLETED
        ? { status: GoalStatus.ACTIVE }
        : {}),
    },
  });
}
