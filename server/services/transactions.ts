import { TransactionStatus, TransactionType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, ForbiddenError, NotFoundError } from "../api/errors";
import type {
  CreateTransactionInput,
  ListTransactionsInput,
  UpdateTransactionInput,
} from "../schemas/transactions";
import {
  applyBalanceDeltas,
  applyLinkedEntityEffects,
  computeTransactionBalanceDeltas,
  computeTransactionLinkedEntityEffects,
  reverseBalanceDeltas,
  reverseLinkedEntityEffects,
} from "./financial-ledger";
import { assertHouseholdAccess } from "./households";

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

    await applyBalanceDeltas(
      tx,
      computeTransactionBalanceDeltas({
        type: transaction.type,
        status: transaction.status,
        accountId: transaction.accountId,
        transferAccountId: transaction.transferAccountId,
        amount: transaction.amount,
        transferAmount: transaction.transferAmount,
      }),
    );

    await applyLinkedEntityEffects(
      tx,
      computeTransactionLinkedEntityEffects({
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
      status: input.status ?? { not: TransactionStatus.CANCELED },
      deletedAt: null,
      occurredAt: {
        gte: input.from,
        lte: input.to ? new Date(input.to.getTime() + 86_400_000 - 1) : undefined,
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
    await applyBalanceDeltas(
      tx,
      reverseBalanceDeltas(
        computeTransactionBalanceDeltas({
          type: current.type,
          status: current.status,
          accountId: current.accountId,
          transferAccountId: current.transferAccountId,
          amount: current.amount,
          transferAmount: current.transferAmount,
        }),
      ),
    );

    await applyLinkedEntityEffects(
      tx,
      reverseLinkedEntityEffects(
        computeTransactionLinkedEntityEffects({
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
    await applyBalanceDeltas(
      tx,
      computeTransactionBalanceDeltas({
        type: updated.type,
        status: updated.status,
        accountId: updated.accountId,
        transferAccountId: updated.transferAccountId,
        amount: updated.amount,
        transferAmount: updated.transferAmount,
      }),
    );

    await applyLinkedEntityEffects(
      tx,
      computeTransactionLinkedEntityEffects({
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
    await applyBalanceDeltas(
      tx,
      reverseBalanceDeltas(
        computeTransactionBalanceDeltas({
          type: current.type,
          status: current.status,
          accountId: current.accountId,
          transferAccountId: current.transferAccountId,
          amount: current.amount,
          transferAmount: current.transferAmount,
        }),
      ),
    );

    await applyLinkedEntityEffects(
      tx,
      reverseLinkedEntityEffects(
        computeTransactionLinkedEntityEffects({
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
