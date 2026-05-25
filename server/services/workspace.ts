import { AccountType, CategoryType, CurrencyCode, HouseholdKind, HouseholdMemberStatus, TransactionType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../api/errors";

export async function getPrimaryHousehold(userProfileId: string) {
  const membership = await prisma.householdMember.findFirst({
    where: {
      userProfileId,
      status: HouseholdMemberStatus.ACTIVE,
      deletedAt: null,
      household: {
        kind: HouseholdKind.PERSONAL,
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

  const [accounts, categories, sharedHouseholds] = await Promise.all([
    prisma.account.findMany({
      where: {
        householdId: household.id,
        deletedAt: null,
        isArchived: false,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true, currency: true, currentBalance: true },
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
    prisma.household.findMany({
      where: {
        kind: HouseholdKind.HOUSEHOLD,
        deletedAt: null,
        members: {
          some: {
            userProfileId,
            status: HouseholdMemberStatus.ACTIVE,
            deletedAt: null,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        avatar: true,
        members: {
          where: { status: HouseholdMemberStatus.ACTIVE, deletedAt: null },
          orderBy: { joinedAt: "asc" },
          select: {
            userProfileId: true,
            userProfile: { select: { fullName: true, email: true } },
          },
        },
      },
    }),
  ]);

  const serializeAccounts = (raw: typeof accounts) =>
    raw.map((a) => ({ ...a, currentBalance: a.currentBalance.toString() }));

  if (accounts.length === 0) {
    await ensureDefaultAccount(household.id, userProfileId);
    const defaultAccounts = await prisma.account.findMany({
      where: { householdId: household.id, deletedAt: null, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true, currency: true, currentBalance: true },
    });
    return { household, accounts: serializeAccounts(defaultAccounts), categories, sharedHouseholds };
  }

  return { household, accounts: serializeAccounts(accounts), categories, sharedHouseholds };
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

export async function getGoalWorkspace(userProfileId: string, primaryCurrency: CurrencyCode = CurrencyCode.ARS) {
  const household = await getPrimaryHousehold(userProfileId);

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  threeMonthsAgo.setDate(1);
  threeMonthsAgo.setHours(0, 0, 0, 0);

  const [accounts, expenseAggregate] = await Promise.all([
    prisma.account.findMany({
      where: { householdId: household.id, deletedAt: null, isArchived: false },
      select: { id: true, name: true, type: true, currency: true },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.aggregate({
      where: {
        householdId: household.id,
        type: TransactionType.EXPENSE,
        currency: primaryCurrency,
        status: { not: "CANCELED" },
        occurredAt: { gte: threeMonthsAgo },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
  ]);

  const totalExpenses3m = Number(expenseAggregate._sum?.amount ?? 0);
  const avgMonthlyExpense = Math.round(totalExpenses3m / 3);

  return { household, accounts, avgMonthlyExpense };
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

export async function getAgreementsWorkspace(userProfileId: string) {
  const household = await getPrimaryHousehold(userProfileId);
  const accounts = await prisma.account.findMany({
    where: { householdId: household.id, deletedAt: null, isArchived: false },
    select: { id: true, name: true, type: true, currency: true },
    orderBy: { name: "asc" },
  });
  return { household, accounts };
}
