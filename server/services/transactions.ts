import { HouseholdKind, HouseholdMemberStatus, Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { nextArgentinaDayStart } from "@/lib/dates";
import { prisma } from "../../lib/prisma";
import { ApiError, FieldApiError, ForbiddenError, NotFoundError } from "../api/errors";
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
  getDebtPaymentAmountError,
  toFiniteNumber,
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

  if (input.clientRequestId) {
    const existing = await prisma.transaction.findUnique({
      where: { clientRequestId: input.clientRequestId },
      include: transactionInclude,
    });

    if (existing) {
      if (existing.createdById !== userProfileId || existing.householdId !== input.householdId) {
        throw new ForbiddenError("clientRequestId belongs to another workspace");
      }

      return existing;
    }
  }

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

  try {
    return await prisma.$transaction(async (tx) => {
      if (input.type === TransactionType.DEBT_PAYMENT) {
        await assertDebtPaymentAllowed(tx, input);
      }

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
          clientRequestId: input.clientRequestId,
          type: input.type,
          status: input.status,
          currency: input.currency,
          amount: input.amount,
          transferAmount: input.transferAmount,
          description: input.description,
          notes: input.notes,
          expenseType: input.expenseType,
          origin: input.origin,
          paymentMethod: input.paymentMethod,
          isInstallment: input.isInstallment,
          installmentNumber: input.installmentNumber,
          totalInstallments: input.totalInstallments,
          isRecurring: input.isRecurring,
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

      if (input.sharedHouseholdId) {
        await createEqualSharedTransaction(tx, {
          householdId: input.sharedHouseholdId,
          transactionId: transaction.id,
          paidByUserId: userProfileId,
          amount: transaction.amount,
        });
      }

      return transaction;
    });
  } catch (error) {
    if (
      input.clientRequestId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.transaction.findUnique({
        where: { clientRequestId: input.clientRequestId },
        include: transactionInclude,
      });

      if (existing && existing.createdById === userProfileId && existing.householdId === input.householdId) {
        return existing;
      }
    }

    throw error;
  }
}

export async function listTransactions(
  userProfileId: string,
  input: ListTransactionsInput,
) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const items = await prisma.transaction.findMany({
    where: {
      householdId: input.householdId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      type: input.type,
      status: input.status ?? { not: TransactionStatus.CANCELED },
      deletedAt: null,
      occurredAt: {
        gte: input.from,
        lt: input.to ? nextArgentinaDayStart(input.to) : undefined,
      },
      ...(input.search
        ? {
            OR: [
              { description: { contains: input.search, mode: "insensitive" } },
              { notes: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: transactionInclude,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > input.limit;
  const data = hasMore ? items.slice(0, input.limit) : items;

  return {
    data,
    hasMore,
    nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
  };
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

    if (newType === TransactionType.DEBT_PAYMENT) {
      const nextAmount = input.amount ?? current.amount;
      const previousDebtCredit =
        current.type === TransactionType.DEBT_PAYMENT && current.debtId === newDebtId
          ? current.amount
          : 0;

      await assertDebtPaymentAllowed(tx, {
        householdId: input.householdId,
        debtId: newDebtId,
        amount: nextAmount,
      }, previousDebtCredit);
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
        expenseType: input.expenseType,
        origin: input.origin,
        paymentMethod: input.paymentMethod,
        isInstallment: input.isInstallment,
        installmentNumber: input.installmentNumber,
        totalInstallments: input.totalInstallments,
        isRecurring: input.isRecurring,
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

    await syncSharedTransactionAfterUpdate(tx, updated);

    return updated;
  });
}

async function assertDebtPaymentAllowed(
  tx: Prisma.TransactionClient,
  input: { householdId: string; debtId?: string | null; amount?: Prisma.Decimal | number | null },
  previousDebtCredit: Prisma.Decimal | number = 0,
) {
  if (!input.debtId) {
    throw new FieldApiError(400, "Revisá los campos marcados.", {
      debtId: "Seleccioná una deuda.",
    });
  }

  if (input.amount == null) {
    throw new FieldApiError(400, "Revisá los campos marcados.", {
      amount: "Ingresá un monto.",
    });
  }

  const debt = await tx.debt.findFirst({
    where: {
      id: input.debtId,
      householdId: input.householdId,
      deletedAt: null,
    },
    select: {
      outstandingAmount: true,
      status: true,
    },
  });

  if (!debt) {
    throw new FieldApiError(400, "Revisá los campos marcados.", {
      debtId: "La deuda seleccionada no existe.",
    });
  }

  const isEditingExistingPayment = toFiniteNumber(previousDebtCredit) > 0;

  if (debt.status !== "ACTIVE" && !(isEditingExistingPayment && debt.status === "PAID")) {
    throw new FieldApiError(400, "Revisá los campos marcados.", {
      debtId: "Solo se pueden pagar deudas activas.",
    });
  }

  const amount = toFiniteNumber(input.amount);
  const outstanding = toFiniteNumber(debt.outstandingAmount) + toFiniteNumber(previousDebtCredit);
  const amountError = getDebtPaymentAmountError(amount, outstanding);

  if (amountError) {
    throw new FieldApiError(400, "Revisá los campos marcados.", {
      amount: amountError,
    });
  }
}

export async function exportTransactions(
  userProfileId: string,
  input: Omit<ListTransactionsInput, "limit" | "cursor">,
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
        lt: input.to ? nextArgentinaDayStart(input.to) : undefined,
      },
      ...(input.search
        ? {
            OR: [
              { description: { contains: input.search, mode: "insensitive" } },
              { notes: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: transactionInclude,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
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

    await removeSharedTransactionForTransaction(tx, transactionId);

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
  sharedTransaction: {
    select: {
      id: true,
      householdId: true,
      paidByUserId: true,
      splitMode: true,
      household: { select: { id: true, name: true, avatar: true } },
      participants: {
        select: {
          userId: true,
          amount: true,
          status: true,
        },
      },
    },
  },
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

async function createEqualSharedTransaction(
  tx: Prisma.TransactionClient,
  input: {
    householdId: string;
    transactionId: string;
    paidByUserId: string;
    amount: Prisma.Decimal;
  },
) {
  const household = await tx.household.findFirst({
    where: {
      id: input.householdId,
      kind: HouseholdKind.HOUSEHOLD,
      deletedAt: null,
      members: {
        some: {
          userProfileId: input.paidByUserId,
          status: HouseholdMemberStatus.ACTIVE,
          deletedAt: null,
        },
      },
    },
    select: {
      id: true,
      members: {
        where: { status: HouseholdMemberStatus.ACTIVE, deletedAt: null },
        select: { userProfileId: true },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!household) {
    throw new ForbiddenError("No tenés acceso a ese hogar compartido.");
  }

  if (household.members.length < 2) {
    throw new ApiError(400, "Invitá a otra persona antes de compartir gastos.");
  }

  const share = input.amount.div(household.members.length).toDecimalPlaces(2);

  await tx.sharedTransaction.create({
    data: {
      householdId: input.householdId,
      transactionId: input.transactionId,
      paidByUserId: input.paidByUserId,
      splitMode: "EQUAL",
      participants: {
        create: household.members.map((member) => ({
          userId: member.userProfileId,
          amount: share,
          status: "OPEN",
        })),
      },
    },
  });
}

async function syncSharedTransactionAfterUpdate(
  tx: Prisma.TransactionClient,
  transaction: {
    id: string;
    type: TransactionType;
    amount: Prisma.Decimal;
    status: TransactionStatus;
    sharedTransaction?: {
      id: string;
      householdId: string;
    } | null;
  },
) {
  const shared = transaction.sharedTransaction;

  if (!shared) return;

  if (transaction.type !== TransactionType.EXPENSE || transaction.status === TransactionStatus.CANCELED) {
    await tx.sharedTransactionParticipant.deleteMany({
      where: { sharedTransactionId: shared.id },
    });
    await tx.sharedTransaction.delete({
      where: { id: shared.id },
    });
    return;
  }

  const household = await tx.household.findFirst({
    where: {
      id: shared.householdId,
      kind: HouseholdKind.HOUSEHOLD,
      deletedAt: null,
    },
    select: {
      members: {
        where: { status: HouseholdMemberStatus.ACTIVE, deletedAt: null },
        select: { userProfileId: true },
      },
    },
  });

  if (!household || household.members.length < 2) {
    await tx.sharedTransactionParticipant.deleteMany({
      where: { sharedTransactionId: shared.id },
    });
    await tx.sharedTransaction.delete({
      where: { id: shared.id },
    });
    return;
  }

  const share = transaction.amount.div(household.members.length).toDecimalPlaces(2);

  await tx.sharedTransactionParticipant.deleteMany({
    where: { sharedTransactionId: shared.id },
  });
  await tx.sharedTransaction.update({
    where: { id: shared.id },
    data: {
      participants: {
        create: household.members.map((member) => ({
          userId: member.userProfileId,
          amount: share,
          status: "OPEN",
        })),
      },
    },
  });
}

async function removeSharedTransactionForTransaction(
  tx: Prisma.TransactionClient,
  transactionId: string,
) {
  const shared = await tx.sharedTransaction.findUnique({
    where: { transactionId },
    select: { id: true },
  });

  if (!shared) return;

  await tx.sharedTransactionParticipant.deleteMany({
    where: { sharedTransactionId: shared.id },
  });
  await tx.sharedTransaction.delete({
    where: { id: shared.id },
  });
}
