import { Prisma, RecurrenceFrequency, TransactionOrigin, TransactionStatus, TransactionType } from "@prisma/client";
import { argentinaMonthKey } from "@/lib/dates";
import { prisma } from "../../lib/prisma";
import { ApiError, ForbiddenError, NotFoundError } from "../api/errors";
import type {
  CreateRecurringExpenseInput,
  ListRecurringExpensesInput,
  PayRecurringExpenseInput,
  UpdateRecurringExpenseInput,
} from "../schemas/recurring-expenses";
import { assertHouseholdAccess } from "./households";
import { createTransaction } from "./transactions";

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

export async function payRecurringExpense(
  userProfileId: string,
  id: string,
  input: PayRecurringExpenseInput,
) {
  const item = await prisma.recurringExpense.findFirst({
    where: { id, householdId: input.householdId, deletedAt: null, isActive: true },
    include: recurringInclude,
  });
  if (!item) throw new NotFoundError("Recurrente no encontrado o inactivo.");

  const monthKey = argentinaMonthKey(new Date(input.occurredAt));

  const existingOccurrence = await prisma.recurringExpenseOccurrence.findUnique({
    where: { recurringExpenseId_monthKey: { recurringExpenseId: id, monthKey } },
  });
  if (existingOccurrence?.status === "PAID") {
    throw new ApiError(409, "Este recurrente ya fue registrado como pagado para este mes.");
  }

  const finalAmount = input.finalAmount ?? Number(item.amount);

  const transaction = await createTransaction(userProfileId, {
    householdId: input.householdId,
    accountId: input.accountId,
    type: TransactionType.EXPENSE,
    status: TransactionStatus.CONFIRMED,
    currency: item.currency,
    amount: finalAmount,
    description: item.name,
    categoryId: item.categoryId ?? undefined,
    occurredAt: new Date(input.occurredAt),
    isRecurring: true,
    isInstallment: false,
    origin: TransactionOrigin.MANUAL,
  });

  const nextDueDate = computeNextDueDate(new Date(item.nextDueDate), item.frequency);

  await prisma.$transaction(async (tx) => {
    await tx.recurringExpenseOccurrence.upsert({
      where: { recurringExpenseId_monthKey: { recurringExpenseId: id, monthKey } },
      update: { status: "PAID", paidAt: new Date(), transactionId: transaction.id, finalAmount },
      create: {
        recurringExpenseId: id,
        monthKey,
        status: "PAID",
        paidAt: new Date(),
        transactionId: transaction.id,
        finalAmount,
      },
    });

    await tx.recurringExpense.update({
      where: { id },
      data: { nextDueDate, lastGeneratedAt: new Date() },
    });
  });

  return { transactionId: transaction.id, nextDueDate: nextDueDate.toISOString() };
}

function computeNextDueDate(current: Date, frequency: RecurrenceFrequency): Date {
  const next = new Date(current);
  switch (frequency) {
    case RecurrenceFrequency.WEEKLY:
      next.setDate(next.getDate() + 7);
      break;
    case RecurrenceFrequency.BIWEEKLY:
      next.setDate(next.getDate() + 14);
      break;
    case RecurrenceFrequency.MONTHLY:
      next.setMonth(next.getMonth() + 1);
      break;
    case RecurrenceFrequency.QUARTERLY:
      next.setMonth(next.getMonth() + 3);
      break;
    case RecurrenceFrequency.YEARLY:
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
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
