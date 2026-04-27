import { prisma } from "../../lib/prisma";
import { ForbiddenError, NotFoundError } from "../api/errors";
import type {
  CreateTransactionInput,
  ListTransactionsInput,
  UpdateTransactionInput,
} from "../schemas/transactions";
import { assertHouseholdAccess } from "./households";

export async function createTransaction(userProfileId: string, input: CreateTransactionInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);
  await assertTransactionReferencesBelongToHousehold(input.householdId, input);

  return prisma.transaction.create({
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
    include: {
      account: true,
      transferAccount: true,
      category: true,
      goal: true,
      debt: true,
    },
  });
}

export async function listTransactions(userProfileId: string, input: ListTransactionsInput) {
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
    include: {
      account: true,
      transferAccount: true,
      category: true,
      goal: true,
      debt: true,
    },
    orderBy: { occurredAt: "desc" },
    take: input.limit,
  });
}

export async function updateTransaction(
  userProfileId: string,
  transactionId: string,
  input: UpdateTransactionInput,
) {
  await assertTransactionAccess(userProfileId, transactionId, input.householdId);
  await assertTransactionReferencesBelongToHousehold(input.householdId, input);

  return prisma.transaction.update({
    where: {
      id: transactionId,
    },
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
}

export async function deleteTransaction(
  userProfileId: string,
  transactionId: string,
  householdId: string,
) {
  await assertTransactionAccess(userProfileId, transactionId, householdId);

  return prisma.transaction.update({
    where: {
      id: transactionId,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}

const transactionInclude = {
  account: true,
  transferAccount: true,
  category: true,
  goal: true,
  debt: true,
} as const;

async function assertTransactionAccess(
  userProfileId: string,
  transactionId: string,
  householdId: string,
) {
  await assertHouseholdAccess(userProfileId, householdId);

  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      householdId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!transaction) {
    throw new NotFoundError("Transaction not found");
  }

  return transaction;
}

async function assertTransactionReferencesBelongToHousehold(
  householdId: string,
  input: CreateTransactionInput | UpdateTransactionInput,
) {
  const [account, transferAccount, category, goal, debt, investmentTransaction] = await Promise.all([
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
          where: { id: input.investmentTransactionId, householdId, deletedAt: null },
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
