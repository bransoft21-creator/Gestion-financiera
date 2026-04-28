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
    select: { outstandingAmount: true, status: true },
  });

  if (!debt) return;

  const newOutstanding = Math.max(0, toFiniteNumber(debt.outstandingAmount) + delta);

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
