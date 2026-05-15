import { DebtStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../api/errors";
import type { CreateAccountInput, ListAccountsInput, UpdateAccountInput } from "../schemas/accounts";
import { computeRealLiabilitySummary, toFiniteNumber } from "./financial-ledger";
import { traceFinancialSource } from "./financial-debug";
import { assertHouseholdAccess } from "./households";

type AccountRecord = Prisma.AccountGetPayload<Record<string, never>>;

function serializeAccount(account: AccountRecord) {
  return {
    id: account.id,
    householdId: account.householdId,
    name: account.name,
    type: account.type,
    currency: account.currency,
    openingBalance: toFiniteNumber(account.openingBalance),
    currentBalance: toFiniteNumber(account.currentBalance),
    creditLimit: account.creditLimit != null ? toFiniteNumber(account.creditLimit) : null,
    isArchived: account.isArchived,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export async function listAccounts(userProfileId: string, input: ListAccountsInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const [accounts, debts] = await Promise.all([
    prisma.account.findMany({
      where: {
        householdId: input.householdId,
        deletedAt: null,
        ...(input.includeArchived ? {} : { isArchived: false }),
      },
      orderBy: [{ isArchived: "asc" }, { type: "asc" }, { name: "asc" }],
    }),
    prisma.debt.findMany({
      where: {
        householdId: input.householdId,
        status: { in: [DebtStatus.ACTIVE, DebtStatus.PAUSED, DebtStatus.DEFAULTED] },
        outstandingAmount: { gt: 0 },
        deletedAt: null,
      },
      select: { id: true, type: true, status: true, currency: true, outstandingAmount: true },
    }),
  ]);

  const allAccounts = input.includeArchived
    ? accounts
    : await prisma.account.findMany({
        where: { householdId: input.householdId, deletedAt: null },
      });
  const liabilitySummary = computeRealLiabilitySummary(allAccounts, debts);
  traceFinancialSource({
    endpoint: "/api/accounts",
    householdId: input.householdId,
    source: "computeRealLiabilitySummary",
    computed: {
      assets: liabilitySummary.assets,
      accountLiabilities: liabilitySummary.accountLiabilities,
      debtLiabilities: liabilitySummary.debtLiabilities,
      duplicatedCreditCardDebt: liabilitySummary.duplicatedCreditCardDebt,
      liabilities: liabilitySummary.liabilities,
      netWorth: liabilitySummary.netWorth,
    },
    accounts: allAccounts.filter((account) => toFiniteNumber(account.currentBalance) < 0),
    debts,
  });

  return {
    accounts: accounts.map(serializeAccount),
    ...liabilitySummary,
  };
}

export async function createAccount(userProfileId: string, input: CreateAccountInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const account = await prisma.account.create({
    data: {
      householdId: input.householdId,
      createdById: userProfileId,
      name: input.name,
      type: input.type,
      currency: input.currency,
      openingBalance: input.openingBalance,
      currentBalance: input.openingBalance,
      creditLimit: input.creditLimit,
    },
  });

  return serializeAccount(account);
}

export async function updateAccount(
  userProfileId: string,
  accountId: string,
  input: UpdateAccountInput,
) {
  await assertAccountAccess(userProfileId, accountId, input.householdId);

  const updateData: Prisma.AccountUpdateInput = {
    name: input.name,
    type: input.type,
    currency: input.currency,
    creditLimit: input.creditLimit,
    isArchived: input.isArchived,
  };

  if (input.openingBalance !== undefined) {
    const current = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { openingBalance: true },
    });
    const delta = input.openingBalance - toFiniteNumber(current.openingBalance);
    updateData.openingBalance = input.openingBalance;
    updateData.currentBalance = { increment: delta };
  }

  const account = await prisma.account.update({
    where: { id: accountId },
    data: updateData,
  });

  return serializeAccount(account);
}

export async function archiveAccount(
  userProfileId: string,
  accountId: string,
  householdId: string,
) {
  await assertAccountAccess(userProfileId, accountId, householdId);

  const transactionCount = await prisma.transaction.count({
    where: {
      OR: [{ accountId }, { transferAccountId: accountId }],
      deletedAt: null,
    },
  });

  const account = await prisma.account.update({
    where: { id: accountId },
    data: transactionCount === 0 ? { deletedAt: new Date() } : { isArchived: true },
  });

  return serializeAccount(account);
}

export async function unarchiveAccount(
  userProfileId: string,
  accountId: string,
  householdId: string,
) {
  await assertHouseholdAccess(userProfileId, householdId);

  const account = await prisma.account.findFirst({
    where: { id: accountId, householdId, deletedAt: null },
  });

  if (!account) {
    throw new NotFoundError("Account not found");
  }

  const updated = await prisma.account.update({
    where: { id: accountId },
    data: { isArchived: false },
  });

  return serializeAccount(updated);
}

async function assertAccountAccess(
  userProfileId: string,
  accountId: string,
  householdId: string,
) {
  await assertHouseholdAccess(userProfileId, householdId);

  const account = await prisma.account.findFirst({
    where: { id: accountId, householdId, deletedAt: null },
    select: { id: true },
  });

  if (!account) {
    throw new NotFoundError("Account not found");
  }

  return account;
}
