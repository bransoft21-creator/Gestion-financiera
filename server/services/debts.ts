import { DebtStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../api/errors";
import type { CreateDebtInput, ListDebtsInput, UpdateDebtInput } from "../schemas/debts";
import { assertHouseholdAccess } from "./households";

type DebtRecord = Prisma.DebtGetPayload<Record<string, never>>;

function serializeDebt(debt: DebtRecord) {
  const original = Number(debt.originalAmount);
  const outstanding = Number(debt.outstandingAmount);
  const paid = Math.max(original - outstanding, 0);
  const paidPercent = original > 0 ? Math.min((paid / original) * 100, 100) : 0;

  return {
    id: debt.id,
    householdId: debt.householdId,
    name: debt.name,
    lender: debt.lender,
    type: debt.type,
    status: debt.status,
    currency: debt.currency,
    originalAmount: original,
    outstandingAmount: outstanding,
    minimumPayment: debt.minimumPayment ? Number(debt.minimumPayment) : null,
    interestRate: debt.interestRate ? Number(debt.interestRate) : null,
    nextDueDate: debt.nextDueDate?.toISOString() ?? null,
    dueDay: debt.dueDay,
    notes: debt.notes,
    paidPercent,
    createdAt: debt.createdAt.toISOString(),
    updatedAt: debt.updatedAt.toISOString(),
  };
}

export async function listDebts(userProfileId: string, input: ListDebtsInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const debts = await prisma.debt.findMany({
    where: {
      householdId: input.householdId,
      deletedAt: null,
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: [{ status: "asc" }, { nextDueDate: "asc" }, { name: "asc" }],
  });

  const totalOutstanding = debts
    .filter((d) => d.status === DebtStatus.ACTIVE)
    .reduce((sum, d) => sum + Number(d.outstandingAmount), 0);

  return { debts: debts.map(serializeDebt), totalOutstanding };
}

export async function createDebt(userProfileId: string, input: CreateDebtInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const debt = await prisma.debt.create({
    data: {
      householdId: input.householdId,
      createdById: userProfileId,
      name: input.name,
      lender: input.lender,
      type: input.type,
      currency: input.currency,
      originalAmount: input.originalAmount,
      outstandingAmount: input.outstandingAmount,
      minimumPayment: input.minimumPayment,
      interestRate: input.interestRate,
      nextDueDate: input.nextDueDate,
      dueDay: input.dueDay,
      notes: input.notes,
    },
  });

  return serializeDebt(debt);
}

export async function updateDebt(
  userProfileId: string,
  debtId: string,
  input: UpdateDebtInput,
) {
  await assertDebtAccess(userProfileId, debtId, input.householdId);

  const debt = await prisma.debt.update({
    where: { id: debtId },
    data: {
      name: input.name,
      lender: input.lender,
      type: input.type,
      status: input.status,
      currency: input.currency,
      originalAmount: input.originalAmount,
      outstandingAmount: input.outstandingAmount,
      minimumPayment: input.minimumPayment,
      interestRate: input.interestRate,
      nextDueDate: input.nextDueDate,
      dueDay: input.dueDay,
      notes: input.notes,
    },
  });

  return serializeDebt(debt);
}

export async function deleteDebt(
  userProfileId: string,
  debtId: string,
  householdId: string,
) {
  await assertDebtAccess(userProfileId, debtId, householdId);

  return prisma.debt.update({
    where: { id: debtId },
    data: { deletedAt: new Date() },
  });
}

async function assertDebtAccess(
  userProfileId: string,
  debtId: string,
  householdId: string,
) {
  await assertHouseholdAccess(userProfileId, householdId);

  const debt = await prisma.debt.findFirst({
    where: { id: debtId, householdId, deletedAt: null },
    select: { id: true },
  });

  if (!debt) {
    throw new NotFoundError("Debt not found");
  }

  return debt;
}
