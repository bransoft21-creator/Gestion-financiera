import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ForbiddenError, NotFoundError } from "../api/errors";
import type {
  CreateRecurringExpenseInput,
  ListRecurringExpensesInput,
  UpdateRecurringExpenseInput,
} from "../schemas/recurring-expenses";
import { assertHouseholdAccess } from "./households";

const recurringInclude = {
  account: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.RecurringExpenseInclude;

type RecurringRecord = Prisma.RecurringExpenseGetPayload<{ include: typeof recurringInclude }>;

function serializeRecurring(item: RecurringRecord) {
  const now = new Date();
  const due = new Date(item.nextDueDate);
  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    id: item.id,
    householdId: item.householdId,
    name: item.name,
    currency: item.currency,
    amount: Number(item.amount),
    frequency: item.frequency,
    nextDueDate: item.nextDueDate.toISOString(),
    endDate: item.endDate?.toISOString() ?? null,
    isActive: item.isActive,
    notes: item.notes,
    daysUntilDue,
    isDueSoon: daysUntilDue <= 30,
    account: item.account,
    category: item.category,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function listRecurringExpenses(
  userProfileId: string,
  input: ListRecurringExpensesInput,
) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const recurringExpenses = await prisma.recurringExpense.findMany({
    where: {
      householdId: input.householdId,
      deletedAt: null,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: recurringInclude,
    orderBy: [{ isActive: "desc" }, { nextDueDate: "asc" }],
  });

  const serialized = recurringExpenses.map(serializeRecurring);
  const upcomingCount = serialized.filter((r) => r.isDueSoon && r.isActive).length;

  return { recurringExpenses: serialized, upcomingCount };
}

export async function createRecurringExpense(
  userProfileId: string,
  input: CreateRecurringExpenseInput,
) {
  await assertHouseholdAccess(userProfileId, input.householdId);
  await assertReferencesInHousehold(input.householdId, input.accountId, input.categoryId);

  const item = await prisma.recurringExpense.create({
    data: {
      householdId: input.householdId,
      createdById: userProfileId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      name: input.name,
      currency: input.currency,
      amount: input.amount,
      frequency: input.frequency,
      nextDueDate: input.nextDueDate,
      endDate: input.endDate,
      notes: input.notes,
    },
    include: recurringInclude,
  });

  return serializeRecurring(item);
}

export async function updateRecurringExpense(
  userProfileId: string,
  id: string,
  input: UpdateRecurringExpenseInput,
) {
  await assertRecurringExpenseAccess(userProfileId, id, input.householdId);
  await assertReferencesInHousehold(input.householdId, input.accountId ?? undefined, input.categoryId ?? undefined);

  const item = await prisma.recurringExpense.update({
    where: { id },
    data: {
      accountId: input.accountId,
      categoryId: input.categoryId,
      name: input.name,
      currency: input.currency,
      amount: input.amount,
      frequency: input.frequency,
      nextDueDate: input.nextDueDate,
      endDate: input.endDate,
      isActive: input.isActive,
      notes: input.notes,
    },
    include: recurringInclude,
  });

  return serializeRecurring(item);
}

export async function deleteRecurringExpense(
  userProfileId: string,
  id: string,
  householdId: string,
) {
  await assertRecurringExpenseAccess(userProfileId, id, householdId);

  return prisma.recurringExpense.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function toggleRecurringExpense(
  userProfileId: string,
  id: string,
  householdId: string,
  isActive: boolean,
) {
  await assertRecurringExpenseAccess(userProfileId, id, householdId);

  const item = await prisma.recurringExpense.update({
    where: { id },
    data: { isActive },
    include: recurringInclude,
  });

  return serializeRecurring(item);
}

async function assertRecurringExpenseAccess(
  userProfileId: string,
  id: string,
  householdId: string,
) {
  await assertHouseholdAccess(userProfileId, householdId);

  const item = await prisma.recurringExpense.findFirst({
    where: { id, householdId, deletedAt: null },
    select: { id: true },
  });

  if (!item) {
    throw new NotFoundError("Recurring expense not found");
  }

  return item;
}

async function assertReferencesInHousehold(
  householdId: string,
  accountId?: string,
  categoryId?: string,
) {
  const [account, category] = await Promise.all([
    accountId
      ? prisma.account.findFirst({ where: { id: accountId, householdId, deletedAt: null }, select: { id: true } })
      : null,
    categoryId
      ? prisma.category.findFirst({ where: { id: categoryId, householdId, deletedAt: null }, select: { id: true } })
      : null,
  ]);

  if (accountId && !account) {
    throw new ForbiddenError("Account does not belong to this household");
  }

  if (categoryId && !category) {
    throw new ForbiddenError("Category does not belong to this household");
  }
}
