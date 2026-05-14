import { HouseholdMemberStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError, NotFoundError } from "../api/errors";
import {
  type CreateRecurringPaymentInput,
  type MarkRecurringPaymentAsPaidInput,
  type UpdateRecurringPaymentInput,
} from "../schemas/households";
import { assertCollaborativeHouseholdAccess, assertHouseholdAccess } from "./households";
import { createTransaction } from "./transactions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getArgentinaMonthKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

function getArgentinaDayMonthYear(date: Date): { day: number; month: number; year: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
    day: Number(parts.find((p) => p.type === "day")?.value),
  };
}

export function computeRecurringPaymentStatus(
  dueDay: number,
  monthKey: string,
  isPaid: boolean,
  now: Date = new Date(),
): "PENDING" | "PAID" | "OVERDUE" {
  if (isPaid) return "PAID";

  const currentMonthKey = getArgentinaMonthKey(now);
  const { day: todayDay } = getArgentinaDayMonthYear(now);

  if (monthKey < currentMonthKey) return "OVERDUE";
  if (monthKey === currentMonthKey && todayDay > dueDay) return "OVERDUE";
  return "PENDING";
}

function buildSummary(paidCount: number, overdueCount: number, totalCount: number): string {
  if (totalCount === 0) return "";
  if (paidCount === totalCount) return "Los gastos fijos del hogar están al día.";
  if (overdueCount > 0) {
    return `Todavía ${overdueCount > 1 ? `quedan ${overdueCount} pagos` : "queda 1 pago"} por cubrir.`;
  }
  return `${paidCount} de ${totalCount} pago${totalCount > 1 ? "s" : ""} del hogar ${paidCount === 1 ? "está cubierto" : "están cubiertos"}.`;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listHouseholdRecurringPayments(
  userProfileId: string,
  householdId: string,
  monthKey?: string,
) {
  await assertCollaborativeHouseholdAccess(userProfileId, householdId);

  const resolvedMonthKey = monthKey ?? getArgentinaMonthKey(new Date());

  const payments = await prisma.householdRecurringPayment.findMany({
    where: { householdId, isActive: true, deletedAt: null },
    orderBy: [{ dueDay: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      currency: true,
      estimatedAmount: true,
      dueDay: true,
      splitMode: true,
      category: { select: { id: true, name: true, color: true } },
      participants: {
        select: { userId: true, percentage: true, fixedAmount: true },
      },
      occurrences: {
        where: { monthKey: resolvedMonthKey },
        take: 1,
        select: {
          id: true,
          status: true,
          paidAt: true,
          paidByUserId: true,
          finalAmount: true,
          sharedTransactionId: true,
        },
      },
    },
  });

  const now = new Date();
  let paidCount = 0;
  let pendingCount = 0;
  let overdueCount = 0;

  const enriched = payments.map((payment) => {
    const occurrence = payment.occurrences[0] ?? null;
    const isPaid = occurrence?.status === "PAID";
    const status = computeRecurringPaymentStatus(payment.dueDay, resolvedMonthKey, isPaid, now);

    if (status === "PAID") paidCount++;
    else if (status === "OVERDUE") overdueCount++;
    else pendingCount++;

    return {
      id: payment.id,
      name: payment.name,
      estimatedAmount: Number(payment.estimatedAmount),
      currency: payment.currency,
      dueDay: payment.dueDay,
      splitMode: payment.splitMode,
      category: payment.category,
      participants: payment.participants.map((p) => ({
        userId: p.userId,
        percentage: p.percentage !== null ? Number(p.percentage) : null,
        fixedAmount: p.fixedAmount !== null ? Number(p.fixedAmount) : null,
      })),
      status,
      occurrence: occurrence
        ? {
            id: occurrence.id,
            paidAt: occurrence.paidAt?.toISOString() ?? null,
            paidByUserId: occurrence.paidByUserId,
            finalAmount: occurrence.finalAmount !== null ? Number(occurrence.finalAmount) : null,
            sharedTransactionId: occurrence.sharedTransactionId,
          }
        : null,
    };
  });

  const totalCount = enriched.length;
  const summary = buildSummary(paidCount, overdueCount, totalCount);

  return {
    payments: enriched,
    paidCount,
    pendingCount,
    overdueCount,
    totalCount,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createHouseholdRecurringPayment(
  userProfileId: string,
  input: CreateRecurringPaymentInput,
) {
  await assertCollaborativeHouseholdAccess(userProfileId, input.householdId);

  if (
    input.splitMode !== "EQUAL" &&
    input.participants &&
    input.participants.length > 0
  ) {
    const members = await prisma.householdMember.findMany({
      where: { householdId: input.householdId, status: HouseholdMemberStatus.ACTIVE, deletedAt: null },
      select: { userProfileId: true },
    });
    const memberIds = new Set(members.map((m) => m.userProfileId));

    for (const p of input.participants) {
      if (!memberIds.has(p.userId)) {
        throw new ApiError(400, "Uno de los participantes no pertenece al hogar.");
      }
    }

    if (input.splitMode === "PERCENTAGE") {
      const sum = input.participants.reduce((acc, p) => acc + p.value, 0);
      if (Math.abs(sum - 100) > 0.5) {
        throw new ApiError(400, "Los porcentajes deben sumar 100%.");
      }
    }
  }

  return prisma.householdRecurringPayment.create({
    data: {
      householdId: input.householdId,
      createdById: userProfileId,
      name: input.name,
      estimatedAmount: input.estimatedAmount,
      dueDay: input.dueDay,
      currency: input.currency,
      categoryId: input.categoryId ?? null,
      splitMode: input.splitMode,
      participants:
        input.participants && input.participants.length > 0
          ? {
              create: input.participants.map((p) => ({
                userId: p.userId,
                ...(input.splitMode === "PERCENTAGE"
                  ? { percentage: p.value }
                  : { fixedAmount: p.value }),
              })),
            }
          : undefined,
    },
    select: {
      id: true,
      name: true,
      estimatedAmount: true,
      currency: true,
      dueDay: true,
      splitMode: true,
      isActive: true,
      createdAt: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateHouseholdRecurringPayment(
  userProfileId: string,
  id: string,
  input: UpdateRecurringPaymentInput,
) {
  await assertCollaborativeHouseholdAccess(userProfileId, input.householdId);

  const existing = await prisma.householdRecurringPayment.findFirst({
    where: { id, householdId: input.householdId, deletedAt: null },
  });

  if (!existing) throw new NotFoundError("Pago recurrente no encontrado.");

  return prisma.$transaction(async (tx) => {
    if (input.participants !== undefined) {
      await tx.householdRecurringPaymentParticipant.deleteMany({
        where: { recurringPaymentId: id },
      });
    }

    return tx.householdRecurringPayment.update({
      where: { id },
      data: {
        name: input.name,
        estimatedAmount: input.estimatedAmount,
        dueDay: input.dueDay,
        currency: input.currency,
        categoryId: input.categoryId,
        splitMode: input.splitMode,
        participants:
          input.participants && input.participants.length > 0
            ? {
                create: input.participants.map((p) => ({
                  userId: p.userId,
                  ...(input.splitMode === "PERCENTAGE"
                    ? { percentage: p.value }
                    : { fixedAmount: p.value }),
                })),
              }
            : undefined,
      },
      select: {
        id: true,
        name: true,
        estimatedAmount: true,
        currency: true,
        dueDay: true,
        splitMode: true,
        isActive: true,
        updatedAt: true,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Deactivate
// ---------------------------------------------------------------------------

export async function deactivateHouseholdRecurringPayment(
  userProfileId: string,
  id: string,
  householdId: string,
) {
  await assertCollaborativeHouseholdAccess(userProfileId, householdId);

  const existing = await prisma.householdRecurringPayment.findFirst({
    where: { id, householdId, deletedAt: null },
  });

  if (!existing) throw new NotFoundError("Pago recurrente no encontrado.");

  await prisma.householdRecurringPayment.update({
    where: { id },
    data: { isActive: false, deletedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Mark as paid
// ---------------------------------------------------------------------------

export async function markRecurringPaymentAsPaid(
  userProfileId: string,
  recurringPaymentId: string,
  input: MarkRecurringPaymentAsPaidInput,
) {
  await assertCollaborativeHouseholdAccess(userProfileId, input.householdId);

  const recurringPayment = await prisma.householdRecurringPayment.findFirst({
    where: { id: recurringPaymentId, householdId: input.householdId, isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      estimatedAmount: true,
      currency: true,
      dueDay: true,
      splitMode: true,
      categoryId: true,
      participants: {
        select: { userId: true, percentage: true, fixedAmount: true },
      },
    },
  });

  if (!recurringPayment) throw new NotFoundError("Pago recurrente no encontrado o inactivo.");

  // Check for existing PAID occurrence (idempotent)
  const existingOccurrence = await prisma.householdRecurringPaymentOccurrence.findUnique({
    where: {
      recurringPaymentId_monthKey: {
        recurringPaymentId,
        monthKey: input.monthKey,
      },
    },
  });

  if (existingOccurrence?.status === "PAID") {
    throw new ApiError(409, "Este pago ya fue registrado para este mes.");
  }

  // Validate account
  const account = await prisma.account.findFirst({
    where: { id: input.accountId, deletedAt: null },
    select: { householdId: true },
  });

  if (!account) throw new NotFoundError("Cuenta no encontrada.");

  // Verify the calling user has access to the account's household
  await assertHouseholdAccess(userProfileId, account.householdId);

  // Validate paidByUserId is an active household member
  const paidByMember = await prisma.householdMember.findFirst({
    where: {
      householdId: input.householdId,
      userProfileId: input.paidByUserId,
      status: HouseholdMemberStatus.ACTIVE,
      deletedAt: null,
    },
  });

  if (!paidByMember) {
    throw new ApiError(400, "El pagador no es un miembro activo del hogar.");
  }

  // Build splitConfig
  type SplitParticipant = { userId: string; value: number };
  let splitConfig:
    | { mode: "EQUAL" | "PERCENTAGE" | "CUSTOM_AMOUNT"; participants?: SplitParticipant[] }
    | null = null;

  if (recurringPayment.splitMode === "PERCENTAGE" && recurringPayment.participants.length > 0) {
    splitConfig = {
      mode: "PERCENTAGE",
      participants: recurringPayment.participants.map((p) => ({
        userId: p.userId,
        value: Number(p.percentage ?? 0),
      })),
    };
  } else if (recurringPayment.splitMode === "CUSTOM_AMOUNT" && recurringPayment.participants.length > 0) {
    splitConfig = {
      mode: "CUSTOM_AMOUNT",
      participants: recurringPayment.participants.map((p) => ({
        userId: p.userId,
        value: Number(p.fixedAmount ?? 0),
      })),
    };
  } else {
    splitConfig = { mode: "EQUAL" };
  }

  // Compute occurredAt: the dueDay of the monthKey month, clamped to last day
  const [yearStr, monthStr] = input.monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(recurringPayment.dueDay, lastDayOfMonth);
  const occurredAt = new Date(Date.UTC(year, month - 1, clampedDay, 12));

  const finalAmount = input.finalAmount ?? Number(recurringPayment.estimatedAmount);

  // Create the transaction (userProfileId is the calling user / actor)
  const transaction = await createTransaction(userProfileId, {
    householdId: account.householdId,
    accountId: input.accountId,
    type: "EXPENSE" as const,
    status: "CONFIRMED" as const,
    currency: recurringPayment.currency,
    amount: finalAmount,
    description: recurringPayment.name,
    categoryId: recurringPayment.categoryId ?? undefined,
    occurredAt,
    isInstallment: false,
    isRecurring: true,
    origin: "MANUAL" as const,
    sharedHouseholdId: input.householdId,
    splitConfig,
  });

  const paidAt = new Date();

  // Upsert the occurrence
  const occurrence = await prisma.householdRecurringPaymentOccurrence.upsert({
    where: {
      recurringPaymentId_monthKey: {
        recurringPaymentId,
        monthKey: input.monthKey,
      },
    },
    update: {
      status: "PAID",
      paidAt,
      paidByUserId: input.paidByUserId,
      sharedTransactionId: transaction.sharedTransaction?.id ?? null,
      finalAmount,
    },
    create: {
      recurringPaymentId,
      monthKey: input.monthKey,
      status: "PAID",
      paidAt,
      paidByUserId: input.paidByUserId,
      sharedTransactionId: transaction.sharedTransaction?.id ?? null,
      finalAmount,
    },
    select: {
      id: true,
      monthKey: true,
      status: true,
      paidAt: true,
      paidByUserId: true,
      sharedTransactionId: true,
      finalAmount: true,
    },
  });

  return {
    occurrence: {
      ...occurrence,
      finalAmount: occurrence.finalAmount !== null ? Number(occurrence.finalAmount) : null,
    },
    transactionId: transaction.id,
  };
}
