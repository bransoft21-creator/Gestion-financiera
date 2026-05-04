import { AccountType, CategoryType, HouseholdMemberStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../api/errors";

export async function getPrimaryHousehold(userProfileId: string) {
  const membership = await prisma.householdMember.findFirst({
    where: {
      userProfileId,
      status: HouseholdMemberStatus.ACTIVE,
      deletedAt: null,
      household: {
        deletedAt: null,
      },
    },
    include: {
      household: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    throw new NotFoundError("No active household found");
  }

  return membership.household;
}

export async function ensureDefaultAccount(householdId: string, userProfileId: string) {
  const existingAccount = await prisma.account.findFirst({
    where: {
      householdId,
      deletedAt: null,
      isArchived: false,
    },
    orderBy: { createdAt: "asc" },
  });

  if (existingAccount) {
    return existingAccount;
  }

  return prisma.account.create({
    data: {
      householdId,
      createdById: userProfileId,
      name: "Efectivo",
      type: AccountType.CASH,
      currency: "ARS",
      openingBalance: 0,
      currentBalance: 0,
    },
  });
}

export async function getTransactionWorkspace(userProfileId: string) {
  const household = await getPrimaryHousehold(userProfileId);

  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({
      where: {
        householdId: household.id,
        deletedAt: null,
        isArchived: false,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true, currency: true },
    }),
    prisma.category.findMany({
      where: {
        householdId: household.id,
        deletedAt: null,
        isArchived: false,
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
  ]);

  if (accounts.length === 0) {
    await ensureDefaultAccount(household.id, userProfileId);
    const defaultAccounts = await prisma.account.findMany({
      where: { householdId: household.id, deletedAt: null, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true, currency: true },
    });
    return { household, accounts: defaultAccounts, categories };
  }

  return { household, accounts, categories };
}

export async function getCategoryWorkspace(userProfileId: string) {
  const household = await getPrimaryHousehold(userProfileId);
  const categories = await prisma.category.findMany({
    where: {
      householdId: household.id,
      deletedAt: null,
      isArchived: false,
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      color: true,
      icon: true,
      parentId: true,
      isSystem: true,
    },
  });

  return {
    household,
    categories,
  };
}

export async function getBudgetWorkspace(userProfileId: string) {
  const household = await getPrimaryHousehold(userProfileId);
  const categories = await prisma.category.findMany({
    where: {
      householdId: household.id,
      type: CategoryType.EXPENSE,
      deletedAt: null,
      isArchived: false,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      color: true,
    },
  });

  return {
    household,
    categories,
  };
}

export async function getGoalWorkspace(userProfileId: string) {
  const household = await getPrimaryHousehold(userProfileId);
  return { household };
}

export async function getAccountWorkspace(userProfileId: string) {
  const household = await getPrimaryHousehold(userProfileId);
  return { household };
}

export async function getRecurringExpenseWorkspace(userProfileId: string) {
  const household = await getPrimaryHousehold(userProfileId);

  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({
      where: { householdId: household.id, deletedAt: null, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true, currency: true },
    }),
    prisma.category.findMany({
      where: { householdId: household.id, deletedAt: null, isArchived: false },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
  ]);

  return { household, accounts, categories };
}

export async function getDebtWorkspace(userProfileId: string) {
  const household = await getPrimaryHousehold(userProfileId);
  const accounts = await prisma.account.findMany({
    where: { householdId: household.id, deletedAt: null, isArchived: false },
    select: { id: true, name: true, type: true, currency: true },
    orderBy: { name: "asc" },
  });
  return { household, accounts };
}

export async function getReportsWorkspace(userProfileId: string) {
  const household = await getPrimaryHousehold(userProfileId);
  return { household };
}
