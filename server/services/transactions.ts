import { DebtStatus, DebtType, HouseholdKind, HouseholdMemberStatus, Prisma, TransactionStatus, TransactionType } from "@prisma/client";
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

      await applyAccountLinkedDebtCharge(tx, transaction.accountId, transaction.type, transaction.status, transaction.amount, 1);

      if (input.sharedHouseholdId) {
        await createSharedTransaction(tx, {
          householdId: input.sharedHouseholdId,
          transactionId: transaction.id,
          paidByUserId: userProfileId,
          amount: transaction.amount,
          splitConfig: input.splitConfig,
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

  const where: Prisma.TransactionWhereInput = {
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
  };

  const [items, groupedTotals] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: transactionInclude,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    }),
    // Aggregate period totals only on first page — cursor pages skip this to save a query.
    input.cursor
      ? Promise.resolve(null)
      : prisma.transaction.groupBy({
          by: ["type"],
          where,
          _sum: { amount: true },
          _count: { id: true },
        }),
  ]);

  const hasMore = items.length > input.limit;
  const data = hasMore ? items.slice(0, input.limit) : items;

  let totals: { income: number; expenses: number; count: number } | null = null;
  if (groupedTotals) {
    let income = 0, expenses = 0, count = 0;
    for (const row of groupedTotals) {
      count += row._count.id;
      const amount = Number(row._sum.amount ?? 0);
      if (row.type === "INCOME") income += amount;
      else if (row.type !== "TRANSFER") expenses += amount;
    }
    totals = { income, expenses, count };
  }

  return {
    data,
    hasMore,
    nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
    totals,
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
      include: {
        sharedTransaction: { select: { id: true, householdId: true } },
      },
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

    await applyAccountLinkedDebtCharge(tx, current.accountId, current.type, current.status, current.amount, -1);

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

    await applyAccountLinkedDebtCharge(tx, updated.accountId, updated.type, updated.status, updated.amount, 1);

    // Resolve the shared-household state before and after the update.
    const prevSharedHouseholdId = current.sharedTransaction?.householdId ?? null;
    const nextSharedHouseholdId =
      input.sharedHouseholdId !== undefined ? input.sharedHouseholdId : prevSharedHouseholdId;

    // Sharing is only valid for non-canceled EXPENSE transactions.
    const effectiveNextSharedHouseholdId =
      nextSharedHouseholdId &&
      updated.type === TransactionType.EXPENSE &&
      updated.status !== TransactionStatus.CANCELED
        ? nextSharedHouseholdId
        : null;

    const wasShared = Boolean(prevSharedHouseholdId);
    const willBeShared = Boolean(effectiveNextSharedHouseholdId);
    const householdChanged = prevSharedHouseholdId !== effectiveNextSharedHouseholdId;

    if (wasShared && (!willBeShared || householdChanged)) {
      // Case D/E: user unmarked hogar, or type changed to non-EXPENSE, or household switched.
      await removeSharedTransactionForTransaction(tx, transactionId);
    }

    if (willBeShared && (!wasShared || householdChanged)) {
      // Case B: newly marked as shared (or household changed) — create SharedTransaction.
      await createSharedTransaction(tx, {
        householdId: effectiveNextSharedHouseholdId!,
        transactionId: updated.id,
        paidByUserId: userProfileId,
        amount: updated.amount,
        splitConfig: input.splitConfig,
      });
    } else if (wasShared && willBeShared && !householdChanged) {
      // Case C: already shared, recalculate participant amounts.
      await syncSharedTransactionAfterUpdate(tx, updated);
    }

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

    await applyAccountLinkedDebtCharge(tx, current.accountId, current.type, current.status, current.amount, -1);

    await removeSharedTransactionForTransaction(tx, transactionId);

    // 2. Soft-delete the transaction.
    return tx.transaction.update({
      where: { id: transactionId },
      data: { deletedAt: new Date() },
    });
  });
}

// ---------------------------------------------------------------------------
// CC account → linked debt auto-charge
// ---------------------------------------------------------------------------

async function applyAccountLinkedDebtCharge(
  tx: Prisma.TransactionClient,
  accountId: string,
  type: TransactionType,
  status: TransactionStatus,
  amount: Prisma.Decimal | number,
  direction: 1 | -1,
): Promise<void> {
  if (type !== TransactionType.EXPENSE || status === TransactionStatus.CANCELED) return;

  const debt = await tx.debt.findFirst({
    where: {
      accountId,
      type: DebtType.CREDIT_CARD,
      status: { in: [DebtStatus.ACTIVE, DebtStatus.DEFAULTED] },
      deletedAt: null,
    },
    select: { id: true, outstandingAmount: true },
  });

  if (!debt) return;

  const delta = direction * toFiniteNumber(amount);
  const newOutstanding = Math.max(0, toFiniteNumber(debt.outstandingAmount) + delta);

  await tx.debt.update({
    where: { id: debt.id },
    data: { outstandingAmount: newOutstanding },
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
          percentage: true,
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

async function createSharedTransaction(
  tx: Prisma.TransactionClient,
  input: {
    householdId: string;
    transactionId: string;
    paidByUserId: string;
    amount: Prisma.Decimal;
    splitConfig?: {
      mode: "EQUAL" | "PERCENTAGE" | "CUSTOM_AMOUNT";
      participants?: Array<{ userId: string; value: number }>;
    } | null;
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

  if (!household) throw new ForbiddenError("No tenés acceso a ese hogar compartido.");
  if (household.members.length < 2) throw new ApiError(400, "Invitá a otra persona antes de compartir gastos.");

  const mode = input.splitConfig?.mode ?? "EQUAL";
  const activeUserIds = new Set(household.members.map((m) => m.userProfileId));

  type ParticipantData = { userId: string; amount: Prisma.Decimal; percentage: Prisma.Decimal | null };
  let participants: ParticipantData[];

  if (mode === "PERCENTAGE" && input.splitConfig?.participants?.length) {
    for (const p of input.splitConfig.participants) {
      if (!activeUserIds.has(p.userId)) {
        throw new ApiError(400, "Uno de los participantes no pertenece al hogar.");
      }
    }
    const sum = input.splitConfig.participants.reduce((acc, p) => acc + p.value, 0);
    if (Math.abs(sum - 100) > 0.5) {
      throw new FieldApiError(400, "Los porcentajes deben sumar 100%.", {
        splitConfig: "Los porcentajes deben sumar 100%.",
      });
    }
    participants = input.splitConfig.participants.map((p) => ({
      userId: p.userId,
      percentage: new Prisma.Decimal(p.value),
      amount: input.amount.mul(p.value).div(100).toDecimalPlaces(2),
    }));
  } else if (mode === "CUSTOM_AMOUNT" && input.splitConfig?.participants?.length) {
    for (const p of input.splitConfig.participants) {
      if (!activeUserIds.has(p.userId)) {
        throw new ApiError(400, "Uno de los participantes no pertenece al hogar.");
      }
    }
    const sum = input.splitConfig.participants.reduce((acc, p) => acc + p.value, 0);
    if (Math.abs(sum - Number(input.amount)) > 0.5) {
      throw new FieldApiError(400, "Los montos deben sumar el total del gasto.", {
        splitConfig: "Los montos deben sumar el total del gasto.",
      });
    }
    participants = input.splitConfig.participants.map((p) => ({
      userId: p.userId,
      percentage: null,
      amount: new Prisma.Decimal(p.value).toDecimalPlaces(2),
    }));
  } else {
    const share = input.amount.div(household.members.length).toDecimalPlaces(2);
    participants = household.members.map((m) => ({
      userId: m.userProfileId,
      amount: share,
      percentage: null,
    }));
  }

  await tx.sharedTransaction.create({
    data: {
      householdId: input.householdId,
      transactionId: input.transactionId,
      paidByUserId: input.paidByUserId,
      splitMode: mode,
      participants: {
        create: participants.map((p) => ({
          userId: p.userId,
          amount: p.amount,
          percentage: p.percentage,
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
      splitMode: string;
      participants: Array<{
        userId: string;
        amount: Prisma.Decimal;
        percentage: Prisma.Decimal | null;
        status: string;
      }>;
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

  type ParticipantData = { userId: string; amount: Prisma.Decimal; percentage: Prisma.Decimal | null };
  let newParticipants: ParticipantData[];

  if (shared.splitMode === "PERCENTAGE" && shared.participants.length > 0) {
    newParticipants = shared.participants.map((p) => ({
      userId: p.userId,
      percentage: p.percentage,
      amount: p.percentage
        ? transaction.amount.mul(p.percentage).div(100).toDecimalPlaces(2)
        : transaction.amount.div(shared.participants.length).toDecimalPlaces(2),
    }));
  } else if (shared.splitMode === "CUSTOM_AMOUNT" && shared.participants.length > 0) {
    const oldTotal = shared.participants.reduce(
      (acc, p) => acc.add(p.amount),
      new Prisma.Decimal(0),
    );
    newParticipants = shared.participants.map((p) => ({
      userId: p.userId,
      percentage: null,
      amount: oldTotal.greaterThan(0)
        ? transaction.amount.mul(p.amount).div(oldTotal).toDecimalPlaces(2)
        : transaction.amount.div(shared.participants.length).toDecimalPlaces(2),
    }));
  } else {
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
    newParticipants = household.members.map((member) => ({
      userId: member.userProfileId,
      amount: share,
      percentage: null,
    }));
  }

  await tx.sharedTransactionParticipant.deleteMany({
    where: { sharedTransactionId: shared.id },
  });
  await tx.sharedTransaction.update({
    where: { id: shared.id },
    data: {
      participants: {
        create: newParticipants.map((p) => ({
          userId: p.userId,
          amount: p.amount,
          percentage: p.percentage,
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
