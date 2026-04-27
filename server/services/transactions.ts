import { DebtStatus, GoalStatus, Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, ForbiddenError, NotFoundError } from "../api/errors";
import type {
  CreateTransactionInput,
  ListTransactionsInput,
  UpdateTransactionInput,
} from "../schemas/transactions";
import { assertHouseholdAccess } from "./households";

// ---------------------------------------------------------------------------
// Balance delta helpers
// ---------------------------------------------------------------------------

type BalanceDelta = { accountId: string; delta: number }[];

function computeBalanceDelta(t: {
  type: TransactionType;
  status: TransactionStatus;
  accountId: string;
  transferAccountId?: string | null;
  amount: Prisma.Decimal | number;
  transferAmount?: Prisma.Decimal | number | null;
}): BalanceDelta {
  if (t.status === TransactionStatus.CANCELED) return [];

  const amount = Number(t.amount);
  const transferAmount = t.transferAmount != null ? Number(t.transferAmount) : amount;

  switch (t.type) {
    case TransactionType.INCOME:
    case TransactionType.ADJUSTMENT:
      return [{ accountId: t.accountId, delta: amount }];

    case TransactionType.EXPENSE:
    case TransactionType.DEBT_PAYMENT:
    case TransactionType.GOAL_CONTRIBUTION:
    case TransactionType.INVESTMENT:
      return [{ accountId: t.accountId, delta: -amount }];

    case TransactionType.TRANSFER:
      if (!t.transferAccountId) return [{ accountId: t.accountId, delta: -amount }];
      return [
        { accountId: t.accountId, delta: -amount },
        { accountId: t.transferAccountId, delta: transferAmount },
      ];

    default:
      return [];
  }
}

async function applyBalanceDelta(
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

function reverseDeltas(deltas: BalanceDelta): BalanceDelta {
  return deltas.map((d) => ({ ...d, delta: -d.delta }));
}

// ---------------------------------------------------------------------------
// Debt / goal side-effect helpers
// ---------------------------------------------------------------------------

type SideEffects = {
  debtId: string | null;
  debtDelta: number; // negative → reduces outstandingAmount (paying down)
  goalId: string | null;
  goalDelta: number; // positive → increases currentAmount (contributing)
};

const NO_SIDE_EFFECTS: SideEffects = {
  debtId: null,
  debtDelta: 0,
  goalId: null,
  goalDelta: 0,
};

function computeSideEffects(t: {
  type: TransactionType;
  status: TransactionStatus;
  debtId?: string | null;
  goalId?: string | null;
  amount: Prisma.Decimal | number;
}): SideEffects {
  if (t.status === TransactionStatus.CANCELED) return NO_SIDE_EFFECTS;

  const amount = Number(t.amount);

  if (t.type === TransactionType.DEBT_PAYMENT && t.debtId) {
    return { ...NO_SIDE_EFFECTS, debtId: t.debtId, debtDelta: -amount };
  }

  if (t.type === TransactionType.GOAL_CONTRIBUTION && t.goalId) {
    return { ...NO_SIDE_EFFECTS, goalId: t.goalId, goalDelta: amount };
  }

  return NO_SIDE_EFFECTS;
}

function reverseSideEffects(effects: SideEffects): SideEffects {
  return {
    debtId: effects.debtId,
    debtDelta: -effects.debtDelta,
    goalId: effects.goalId,
    goalDelta: -effects.goalDelta,
  };
}

async function applySideEffects(
  tx: Prisma.TransactionClient,
  effects: SideEffects,
): Promise<void> {
  if (effects.debtId && effects.debtDelta !== 0) {
    await applyDebtDelta(tx, effects.debtId, effects.debtDelta);
  }
  if (effects.goalId && effects.goalDelta !== 0) {
    await applyGoalDelta(tx, effects.goalId, effects.goalDelta);
  }
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

  // Debt may have been deleted after the transaction was created — skip silently.
  if (!debt) return;

  const newOutstanding = Math.max(0, Number(debt.outstandingAmount) + delta);

  await tx.debt.update({
    where: { id: debtId },
    data: {
      outstandingAmount: newOutstanding,
      // Paid off → mark PAID; previously PAID but now has balance again → reopen as ACTIVE.
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

  // Goal may have been deleted after the transaction was created — skip silently.
  if (!goal) return;

  const newCurrent = Math.max(0, Number(goal.currentAmount) + delta);
  const target = Number(goal.targetAmount);

  await tx.goal.update({
    where: { id: goalId },
    data: {
      currentAmount: newCurrent,
      // Reached target → mark COMPLETED; previously COMPLETED but now below target → reopen as ACTIVE.
      ...(newCurrent >= target
        ? { status: GoalStatus.COMPLETED }
        : goal.status === GoalStatus.COMPLETED
        ? { status: GoalStatus.ACTIVE }
        : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Public service functions
// ---------------------------------------------------------------------------

export async function createTransaction(
  userProfileId: string,
  input: CreateTransactionInput,
) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  // Cross-field business rules (schema covers the simple cases; service covers
  // the merged-state cases that need current DB values in update/delete).
  if (input.type === TransactionType.TRANSFER && !input.transferAccountId) {
    throw new ApiError(400, "transferAccountId es requerido para transferencias");
  }
  if (input.transferAccountId && input.accountId === input.transferAccountId) {
    throw new ApiError(400, "La cuenta destino no puede ser igual a la cuenta origen");
  }
  if (input.type === TransactionType.DEBT_PAYMENT && !input.debtId) {
    throw new ApiError(400, "debtId es requerido para pagos de deuda");
  }
  if (input.type === TransactionType.GOAL_CONTRIBUTION && !input.goalId) {
    throw new ApiError(400, "goalId es requerido para contribuciones a meta");
  }

  await assertTransactionReferencesBelongToHousehold(input.householdId, input);

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        householdId: input.householdId,
        createdById: userProfileId,
        accountId: input.accountId,
        transferAccountId: input.transferAccountId,
        categoryId: input.categoryId,
        goalId: input.goalId,
        debtId: input.debtId,
        investmentTransactionId: input.investmentTransactionId,
        type: input.type,
        status: input.status,
        currency: input.currency,
        amount: input.amount,
        transferAmount: input.transferAmount,
        description: input.description,
        notes: input.notes,
        occurredAt: input.occurredAt,
      },
      include: transactionInclude,
    });

    await applyBalanceDelta(
      tx,
      computeBalanceDelta({
        type: transaction.type,
        status: transaction.status,
        accountId: transaction.accountId,
        transferAccountId: transaction.transferAccountId,
        amount: transaction.amount,
        transferAmount: transaction.transferAmount,
      }),
    );

    await applySideEffects(
      tx,
      computeSideEffects({
        type: transaction.type,
        status: transaction.status,
        debtId: transaction.debtId,
        goalId: transaction.goalId,
        amount: transaction.amount,
      }),
    );

    return transaction;
  });
}

export async function listTransactions(
  userProfileId: string,
  input: ListTransactionsInput,
) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  return prisma.transaction.findMany({
    where: {
      householdId: input.householdId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      type: input.type,
      status: input.status,
      deletedAt: null,
      occurredAt: {
        gte: input.from,
        lte: input.to,
      },
    },
    include: transactionInclude,
    orderBy: { occurredAt: "desc" },
    take: input.limit,
  });
}

export async function updateTransaction(
  userProfileId: string,
  transactionId: string,
  input: UpdateTransactionInput,
) {
  await assertHouseholdAccess(userProfileId, input.householdId);
  await assertTransactionReferencesBelongToHousehold(input.householdId, input);

  return prisma.$transaction(async (tx) => {
    const current = await tx.transaction.findFirst({
      where: { id: transactionId, householdId: input.householdId, deletedAt: null },
    });

    if (!current) throw new NotFoundError("Transaction not found");

    // Compute the fully-merged final state for cross-field validation.
    const newType = input.type ?? current.type;
    const newAccountId = input.accountId ?? current.accountId;
    const newTransferAccountId =
      input.transferAccountId !== undefined ? input.transferAccountId : current.transferAccountId;
    const newDebtId =
      input.debtId !== undefined ? input.debtId : current.debtId;
    const newGoalId =
      input.goalId !== undefined ? input.goalId : current.goalId;

    if (newType === TransactionType.TRANSFER && !newTransferAccountId) {
      throw new ApiError(400, "transferAccountId es requerido para transferencias");
    }
    if (newTransferAccountId && newAccountId === newTransferAccountId) {
      throw new ApiError(400, "La cuenta destino no puede ser igual a la cuenta origen");
    }
    if (newType === TransactionType.DEBT_PAYMENT && !newDebtId) {
      throw new ApiError(400, "debtId es requerido para pagos de deuda");
    }
    if (newType === TransactionType.GOAL_CONTRIBUTION && !newGoalId) {
      throw new ApiError(400, "goalId es requerido para contribuciones a meta");
    }

    // 1. Revert old balance and side effects.
    await applyBalanceDelta(
      tx,
      reverseDeltas(
        computeBalanceDelta({
          type: current.type,
          status: current.status,
          accountId: current.accountId,
          transferAccountId: current.transferAccountId,
          amount: current.amount,
          transferAmount: current.transferAmount,
        }),
      ),
    );

    await applySideEffects(
      tx,
      reverseSideEffects(
        computeSideEffects({
          type: current.type,
          status: current.status,
          debtId: current.debtId,
          goalId: current.goalId,
          amount: current.amount,
        }),
      ),
    );

    // 2. Persist the update.
    const updated = await tx.transaction.update({
      where: { id: transactionId },
      data: {
        accountId: input.accountId,
        transferAccountId: input.transferAccountId,
        categoryId: input.categoryId,
        goalId: input.goalId,
        debtId: input.debtId,
        investmentTransactionId: input.investmentTransactionId,
        type: input.type,
        status: input.status,
        currency: input.currency,
        amount: input.amount,
        transferAmount: input.transferAmount,
        description: input.description,
        notes: input.notes,
        occurredAt: input.occurredAt,
      },
      include: transactionInclude,
    });

    // 3. Apply new balance and side effects from the persisted final state.
    await applyBalanceDelta(
      tx,
      computeBalanceDelta({
        type: updated.type,
        status: updated.status,
        accountId: updated.accountId,
        transferAccountId: updated.transferAccountId,
        amount: updated.amount,
        transferAmount: updated.transferAmount,
      }),
    );

    await applySideEffects(
      tx,
      computeSideEffects({
        type: updated.type,
        status: updated.status,
        debtId: updated.debtId,
        goalId: updated.goalId,
        amount: updated.amount,
      }),
    );

    return updated;
  });
}

export async function deleteTransaction(
  userProfileId: string,
  transactionId: string,
  householdId: string,
) {
  await assertHouseholdAccess(userProfileId, householdId);

  return prisma.$transaction(async (tx) => {
    const current = await tx.transaction.findFirst({
      where: { id: transactionId, householdId, deletedAt: null },
    });

    if (!current) throw new NotFoundError("Transaction not found");

    // 1. Revert balance and side effects.
    await applyBalanceDelta(
      tx,
      reverseDeltas(
        computeBalanceDelta({
          type: current.type,
          status: current.status,
          accountId: current.accountId,
          transferAccountId: current.transferAccountId,
          amount: current.amount,
          transferAmount: current.transferAmount,
        }),
      ),
    );

    await applySideEffects(
      tx,
      reverseSideEffects(
        computeSideEffects({
          type: current.type,
          status: current.status,
          debtId: current.debtId,
          goalId: current.goalId,
          amount: current.amount,
        }),
      ),
    );

    // 2. Soft-delete the transaction.
    return tx.transaction.update({
      where: { id: transactionId },
      data: { deletedAt: new Date() },
    });
  });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const transactionInclude = {
  account: true,
  transferAccount: true,
  category: true,
  goal: true,
  debt: true,
} as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function assertTransactionReferencesBelongToHousehold(
  householdId: string,
  input: CreateTransactionInput | UpdateTransactionInput,
) {
  const [account, transferAccount, category, goal, debt, investmentTransaction] =
    await Promise.all([
      input.accountId
        ? prisma.account.findFirst({
            where: { id: input.accountId, householdId, deletedAt: null },
            select: { id: true },
          })
        : null,
      input.transferAccountId
        ? prisma.account.findFirst({
            where: { id: input.transferAccountId, householdId, deletedAt: null },
            select: { id: true },
          })
        : null,
      input.categoryId
        ? prisma.category.findFirst({
            where: { id: input.categoryId, householdId, deletedAt: null },
            select: { id: true },
          })
        : null,
      input.goalId
        ? prisma.goal.findFirst({
            where: { id: input.goalId, householdId, deletedAt: null },
            select: { id: true },
          })
        : null,
      input.debtId
        ? prisma.debt.findFirst({
            where: { id: input.debtId, householdId, deletedAt: null },
            select: { id: true },
          })
        : null,
      input.investmentTransactionId
        ? prisma.investmentTransaction.findFirst({
            where: {
              id: input.investmentTransactionId,
              householdId,
              deletedAt: null,
            },
            select: { id: true },
          })
        : null,
    ]);

  if (input.accountId && !account) {
    throw new ForbiddenError("Account does not belong to this household");
  }
  if (input.transferAccountId && !transferAccount) {
    throw new ForbiddenError("Transfer account does not belong to this household");
  }
  if (input.categoryId && !category) {
    throw new ForbiddenError("Category does not belong to this household");
  }
  if (input.goalId && !goal) {
    throw new ForbiddenError("Goal does not belong to this household");
  }
  if (input.debtId && !debt) {
    throw new ForbiddenError("Debt does not belong to this household");
  }
  if (input.investmentTransactionId && !investmentTransaction) {
    throw new ForbiddenError("Investment transaction does not belong to this household");
  }
}
