import { AccountType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../api/errors";
import type { CreateAccountInput, ListAccountsInput, UpdateAccountInput } from "../schemas/accounts";
import { assertHouseholdAccess } from "./households";

type AccountRecord = Prisma.AccountGetPayload<Record<string, never>>;

function serializeAccount(account: AccountRecord) {
  return {
    id: account.id,
    householdId: account.householdId,
    name: account.name,
    type: account.type,
    currency: account.currency,
    openingBalance: Number(account.openingBalance),
    currentBalance: Number(account.currentBalance),
    creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
    isArchived: account.isArchived,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function computeNetWorth(accounts: AccountRecord[]) {
  const active = accounts.filter((a) => !a.isArchived && !a.deletedAt);
  const assets = active
    .filter((a) => a.type !== AccountType.CREDIT_CARD)
    .reduce((sum, a) => sum + Number(a.currentBalance), 0);
  const liabilities = active
    .filter((a) => a.type === AccountType.CREDIT_CARD)
    .reduce((sum, a) => sum + Number(a.currentBalance), 0);
  return { assets, liabilities, netWorth: assets - liabilities };
}

export async function listAccounts(userProfileId: string, input: ListAccountsInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const accounts = await prisma.account.findMany({
    where: {
      householdId: input.householdId,
      deletedAt: null,
      ...(input.includeArchived ? {} : { isArchived: false }),
    },
    orderBy: [{ isArchived: "asc" }, { type: "asc" }, { name: "asc" }],
  });

  const allAccounts = input.includeArchived
    ? accounts
    : await prisma.account.findMany({
        where: { householdId: input.householdId, deletedAt: null },
      });

  return {
    accounts: accounts.map(serializeAccount),
    ...computeNetWorth(allAccounts),
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

  const account = await prisma.account.update({
    where: { id: accountId },
    data: {
      name: input.name,
      type: input.type,
      currency: input.currency,
      creditLimit: input.creditLimit,
      isArchived: input.isArchived,
    },
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
