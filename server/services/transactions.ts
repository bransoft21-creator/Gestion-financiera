import { Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, ForbiddenError, NotFoundError } from "../api/errors";
import type {
  CreateTransactionInput,
  ListTransactionsInput,
  UpdateTransactionInput,
} from "../schemas/transactions";
import { assertHouseholdAccess } from "./households";

// --- Balance delta helpers ---

type BalanceDelta = { accountId: string; delta: number }[];

function computeBalanceDelta(t: {
  type: TransactionType;
  status: TransactionStatus;
  accountId: string;
  transferAccountId?: string | null;
  amount: Prisma.Decimal | number;
  transferAmount?: Prisma.Decimal | number | null;
}): BalanceDelta {
  // Cancelled or deleted transactions have no balance impact
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

// --- Public service functions ---

export async function createTransaction(
  userProfileId: string,
  input: CreateTransactionInput,
) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  if (input.type === TransactionType.TRANSFER && !input.transferAccountId) {
    throw new ApiError(400, "transferAccountId es requerido para transferencias");
  }
  if (input.transferAccountId && input.accountId === input.transferAccountId) {
    throw new ApiError(400, "La cuenta destino no puede ser igual a la cuenta origen");
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

    // Compute the merged final state to validate TRANSFER rules
    const newType = input.type ?? current.type;
    const newAccountId = input.accountId ?? current.accountId;
    const newTransferAccountId =
      input.transferAccountId !== undefined
        ? input.transferAccountId
        : current.transferAccountId;

    if (newType === TransactionType.TRANSFER && !newTransferAccountId) {
      throw new ApiError(400, "transferAccountId es requerido para transferencias");
    }
    if (newTransferAccountId && newAccountId === newTransferAccountId) {
      throw new ApiError(400, "La cuenta destino no puede ser igual a la cuenta origen");
    }

    // Revert old balance impact before applying changes
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

    // Apply new balance impact using the persisted final state
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

    // Revert balance impact before soft-deleting
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

    return tx.transaction.update({
      where: { id: transactionId },
      data: { deletedAt: new Date() },
    });
  });
}

// --- Constants ---

const transactionInclude = {
  account: true,
  transferAccount: true,
  category: true,
  goal: true,
  debt: true,
} as const;

// --- Internal helpers ---

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
