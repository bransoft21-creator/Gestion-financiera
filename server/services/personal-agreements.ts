import {
  AgreementDirection,
  AgreementEventType,
  AgreementStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "../api/errors";
import type {
  CloseAgreementInput,
  CreateAgreementEventInput,
  CreateAgreementInput,
  ListAgreementsInput,
  UpdateAgreementInput,
} from "../schemas/personal-agreements";
import { assertHouseholdAccess } from "./households";
import { applyBalanceDeltas, computeTransactionBalanceDeltas } from "./financial-ledger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgreementRecord = Prisma.PersonalAgreementGetPayload<{
  include: { contact: true; events: true };
}>;

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

function serializeAgreement(a: AgreementRecord) {
  const isOverdue =
    (a.status === AgreementStatus.OPEN || a.status === AgreementStatus.PARTIAL) &&
    a.agreedReturnDate != null &&
    a.agreedReturnDate < new Date();

  return {
    id: a.id,
    householdId: a.householdId,
    contactId: a.contactId,
    contact: {
      id: a.contact.id,
      name: a.contact.name,
      alias: a.contact.alias,
      avatarColor: a.contact.avatarColor,
    },
    direction: a.direction,
    status: isOverdue && a.status !== AgreementStatus.OPEN
      ? AgreementStatus.OVERDUE
      : isOverdue
      ? AgreementStatus.OVERDUE
      : a.status,
    currency: a.currency,
    originalAmount: Number(a.originalAmount),
    currentBalance: Number(a.currentBalance),
    paidPercent: computePaidPercent(Number(a.originalAmount), Number(a.currentBalance)),
    description: a.description,
    category: a.category,
    agreedReturnDate: a.agreedReturnDate?.toISOString() ?? null,
    occurredAt: a.occurredAt.toISOString(),
    hasInterest: a.hasInterest,
    interestType: a.interestType,
    interestAmount: a.interestAmount != null ? Number(a.interestAmount) : null,
    interestRate: a.interestRate != null ? Number(a.interestRate) : null,
    expectedInstallments: a.expectedInstallments,
    sourceAccountId: a.sourceAccountId,
    closedAt: a.closedAt?.toISOString() ?? null,
    notes: a.notes,
    events: a.events.map(serializeEvent),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

function serializeEvent(e: Prisma.AgreementEventGetPayload<Record<string, never>>) {
  return {
    id: e.id,
    agreementId: e.agreementId,
    type: e.type,
    amount: e.amount != null ? Number(e.amount) : null,
    currency: e.currency,
    description: e.description,
    transactionId: e.transactionId,
    occurredAt: e.occurredAt.toISOString(),
    createdAt: e.createdAt.toISOString(),
  };
}

function computePaidPercent(original: number, balance: number): number {
  if (original <= 0) return 0;
  const paid = Math.max(original - balance, 0);
  return Math.min(Math.round((paid / original) * 100), 100);
}

// ---------------------------------------------------------------------------
// currentBalance recomputation from events (source of truth)
// ---------------------------------------------------------------------------

async function recomputeBalance(tx: Prisma.TransactionClient, agreementId: string): Promise<number> {
  const [agreement, events] = await Promise.all([
    tx.personalAgreement.findUniqueOrThrow({ where: { id: agreementId } }),
    tx.agreementEvent.findMany({ where: { agreementId } }),
  ]);

  let balance = Number(agreement.originalAmount);

  for (const ev of events) {
    const amount = ev.amount != null ? Number(ev.amount) : 0;
    switch (ev.type) {
      case AgreementEventType.PAYMENT_RECEIVED:
      case AgreementEventType.PAYMENT_SENT:
      case AgreementEventType.PARTIAL_FORGIVEN:
        balance = Math.max(balance - amount, 0);
        break;
      case AgreementEventType.INTEREST_APPLIED:
        balance = balance + amount;
        break;
    }
  }

  return balance;
}

function deriveStatus(balance: number, agreedReturnDate: Date | null, closedAt: Date | null): AgreementStatus {
  if (closedAt) return AgreementStatus.CLOSED;
  if (balance <= 0) return AgreementStatus.CLOSED;
  const isOverdue = agreedReturnDate != null && agreedReturnDate < new Date();
  if (isOverdue) return AgreementStatus.OVERDUE;
  // PARTIAL = had some payments but not fully closed
  return AgreementStatus.OPEN; // PARTIAL computed from paidPercent in serializer for simplicity
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function listAgreements(userProfileId: string, input: ListAgreementsInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const agreements = await prisma.personalAgreement.findMany({
    where: {
      householdId: input.householdId,
      deletedAt: null,
      ...(input.status ? { status: input.status } : { status: { notIn: [AgreementStatus.CANCELED] } }),
      ...(input.direction ? { direction: input.direction } : {}),
      ...(input.contactId ? { contactId: input.contactId } : {}),
    },
    include: { contact: true, events: { orderBy: { occurredAt: "asc" } } },
    orderBy: [{ status: "asc" }, { agreedReturnDate: "asc" }, { occurredAt: "desc" }],
  });

  const serialized = agreements.map(serializeAgreement);

  const summary = computeSummary(serialized);

  return { agreements: serialized, summary };
}

function computeSummary(agreements: ReturnType<typeof serializeAgreement>[]) {
  let totalToReceive = 0;
  let totalToPay = 0;
  let activeCount = 0;
  let overdueCount = 0;

  for (const a of agreements) {
    const isActive = a.status === AgreementStatus.OPEN || a.status === AgreementStatus.PARTIAL || a.status === AgreementStatus.OVERDUE;
    if (!isActive) continue;
    activeCount++;
    if (a.status === AgreementStatus.OVERDUE) overdueCount++;
    if (a.direction === AgreementDirection.LENT || a.direction === AgreementDirection.SHARED) {
      totalToReceive += a.currentBalance;
    } else {
      totalToPay += a.currentBalance;
    }
  }

  return {
    totalToReceive,
    totalToPay,
    netPosition: totalToReceive - totalToPay,
    activeCount,
    overdueCount,
  };
}

export async function getAgreement(userProfileId: string, agreementId: string) {
  const agreement = await prisma.personalAgreement.findFirst({
    where: { id: agreementId, deletedAt: null },
    include: { contact: true, events: { orderBy: { occurredAt: "asc" } } },
  });
  if (!agreement) throw new NotFoundError("Acuerdo no encontrado");
  await assertHouseholdAccess(userProfileId, agreement.householdId);
  return serializeAgreement(agreement);
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createAgreement(userProfileId: string, input: CreateAgreementInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  // Fetch contact name before transaction for description building
  const contact = await prisma.personContact.findUniqueOrThrow({
    where: { id: input.contactId },
    select: { name: true },
  });

  const originalAmount = Number(input.originalAmount);

  const agreement = await prisma.$transaction(async (tx) => {
    const created = await tx.personalAgreement.create({
      data: {
        householdId: input.householdId,
        createdById: userProfileId,
        contactId: input.contactId,
        direction: input.direction,
        currency: input.currency,
        originalAmount,
        currentBalance: originalAmount,
        description: input.description ?? null,
        category: input.category,
        agreedReturnDate: input.agreedReturnDate ? new Date(input.agreedReturnDate) : null,
        occurredAt: new Date(input.occurredAt),
        hasInterest: input.hasInterest,
        interestType: input.interestType ?? null,
        interestAmount: input.interestAmount != null ? Number(input.interestAmount) : null,
        interestRate: input.interestRate ?? null,
        expectedInstallments: input.expectedInstallments ?? null,
        sourceAccountId: input.sourceAccountId ?? null,
        notes: input.notes ?? null,
      },
    });

    // Si hay cuenta origen, generamos la transacción de movimiento de caja
    if (input.sourceAccountId) {
      const txType =
        input.direction === AgreementDirection.BORROWED
          ? TransactionType.PERSONAL_LOAN_RETURN // me prestaron → entra dinero
          : TransactionType.PERSONAL_LOAN_GIVEN;  // presté → sale dinero

      const txRecord = await tx.transaction.create({
        data: {
          householdId: input.householdId,
          createdById: userProfileId,
          accountId: input.sourceAccountId,
          type: txType,
          status: TransactionStatus.CONFIRMED,
          currency: input.currency,
          amount: originalAmount,
          description: `Acuerdo con ${contact.name}${input.description ? ` — ${input.description}` : ""}`,
          occurredAt: new Date(input.occurredAt),
        },
      });

      const deltas = computeTransactionBalanceDeltas({
        type: txType,
        status: TransactionStatus.CONFIRMED,
        accountId: input.sourceAccountId,
        amount: originalAmount,
      });
      await applyBalanceDeltas(tx, deltas);

      await tx.agreementEvent.create({
        data: {
          agreementId: created.id,
          createdById: userProfileId,
          type: AgreementEventType.NOTE_ADDED,
          amount: originalAmount,
          currency: input.currency,
          description: `Acuerdo registrado desde cuenta`,
          transactionId: txRecord.id,
          occurredAt: new Date(input.occurredAt),
        },
      });
    }

    await tx.personContact.update({
      where: { id: input.contactId },
      data: { agreementCount: { increment: 1 } },
    });

    return created;
  });

  return getAgreement(userProfileId, agreement.id);
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateAgreement(userProfileId: string, input: UpdateAgreementInput) {
  const existing = await prisma.personalAgreement.findFirst({
    where: { id: input.agreementId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("Acuerdo no encontrado");
  await assertHouseholdAccess(userProfileId, existing.householdId);

  const updated = await prisma.personalAgreement.update({
    where: { id: input.agreementId },
    data: {
      ...(input.description !== undefined && { description: input.description }),
      ...(input.agreedReturnDate !== undefined && {
        agreedReturnDate: input.agreedReturnDate ? new Date(input.agreedReturnDate) : null,
      }),
      ...(input.expectedInstallments !== undefined && { expectedInstallments: input.expectedInstallments }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.category !== undefined && { category: input.category }),
    },
    include: { contact: true, events: { orderBy: { occurredAt: "asc" } } },
  });

  return serializeAgreement(updated);
}

// ---------------------------------------------------------------------------
// Close
// ---------------------------------------------------------------------------

export async function closeAgreement(userProfileId: string, input: CloseAgreementInput) {
  const existing = await prisma.personalAgreement.findFirst({
    where: { id: input.agreementId, deletedAt: null },
    include: { contact: true },
  });
  if (!existing) throw new NotFoundError("Acuerdo no encontrado");
  await assertHouseholdAccess(userProfileId, existing.householdId);

  const closeStatus =
    input.closeType === "FORGIVEN"
      ? AgreementStatus.FORGIVEN
      : input.closeType === "CANCELED"
      ? AgreementStatus.CANCELED
      : AgreementStatus.CLOSED;

  const eventType =
    input.closeType === "FORGIVEN"
      ? AgreementEventType.PARTIAL_FORGIVEN
      : input.closeType === "CANCELED"
      ? AgreementEventType.CANCELED
      : AgreementEventType.CLOSED;

  await prisma.$transaction(async (tx) => {
    await tx.agreementEvent.create({
      data: {
        agreementId: input.agreementId,
        createdById: userProfileId,
        type: eventType,
        description: input.notes ?? null,
        occurredAt: new Date(),
      },
    });

    await tx.personalAgreement.update({
      where: { id: input.agreementId },
      data: {
        status: closeStatus,
        currentBalance: closeStatus === AgreementStatus.CANCELED ? existing.currentBalance : 0,
        closedAt: new Date(),
      },
    });

    // Actualizar métricas del contacto si es CLOSED (devolución exitosa)
    if (closeStatus === AgreementStatus.CLOSED) {
      const openedAt = existing.occurredAt;
      const returnDays = Math.round((Date.now() - openedAt.getTime()) / (1000 * 60 * 60 * 24));
      const contact = existing.contact;
      const prevAvg = contact.avgReturnDays;
      const prevCount = contact.agreementCount;
      const newAvg =
        prevAvg != null && prevCount > 0
          ? Math.round((prevAvg * (prevCount - 1) + returnDays) / prevCount)
          : returnDays;

      const amount = Number(existing.originalAmount);
      await tx.personContact.update({
        where: { id: existing.contactId },
        data: {
          avgReturnDays: newAvg,
          ...(existing.direction === AgreementDirection.LENT && {
            totalLentToThem: { increment: amount },
          }),
          ...(existing.direction === AgreementDirection.BORROWED && {
            totalBorrowedFromThem: { increment: amount },
          }),
        },
      });
    }
  });

  return getAgreement(userProfileId, input.agreementId);
}

// ---------------------------------------------------------------------------
// Register event (payment, interest, etc.)
// ---------------------------------------------------------------------------

export async function createAgreementEvent(userProfileId: string, input: CreateAgreementEventInput) {
  const agreement = await prisma.personalAgreement.findFirst({
    where: { id: input.agreementId, deletedAt: null },
    include: { contact: true },
  });
  if (!agreement) throw new NotFoundError("Acuerdo no encontrado");
  await assertHouseholdAccess(userProfileId, agreement.householdId);

  const eventAmount = input.amount != null ? Number(input.amount) : null;
  const contactName = agreement.contact.name;

  await prisma.$transaction(async (tx) => {
    let transactionId: string | null = null;

    // Si hay cuenta y es un pago, creamos la transacción real
    if (
      input.accountId &&
      eventAmount &&
      (input.type === AgreementEventType.PAYMENT_RECEIVED || input.type === AgreementEventType.PAYMENT_SENT)
    ) {
      const txType =
        input.type === AgreementEventType.PAYMENT_RECEIVED
          ? TransactionType.PERSONAL_LOAN_RETURN  // entra dinero a la cuenta
          : TransactionType.PERSONAL_LOAN_GIVEN;  // sale dinero de la cuenta

      const txRecord = await tx.transaction.create({
        data: {
          householdId: input.householdId,
          createdById: userProfileId,
          accountId: input.accountId,
          type: txType,
          status: TransactionStatus.CONFIRMED,
          currency: input.currency ?? agreement.currency,
          amount: eventAmount,
          description: `Abono acuerdo con ${contactName}${input.description ? ` — ${input.description}` : ""}`,
          occurredAt: new Date(input.occurredAt),
        },
      });

      const deltas = computeTransactionBalanceDeltas({
        type: txType,
        status: TransactionStatus.CONFIRMED,
        accountId: input.accountId,
        amount: eventAmount,
      });
      await applyBalanceDeltas(tx, deltas);
      transactionId = txRecord.id;
    }

    // Crear evento
    await tx.agreementEvent.create({
      data: {
        agreementId: input.agreementId,
        createdById: userProfileId,
        type: input.type,
        amount: eventAmount,
        currency: input.currency ?? null,
        description: input.description ?? null,
        transactionId: transactionId ?? input.transactionId ?? null,
        occurredAt: new Date(input.occurredAt),
      },
    });

    // Recomputar balance desde eventos
    const newBalance = await recomputeBalance(tx, input.agreementId);
    const newStatus = newBalance <= 0
      ? AgreementStatus.CLOSED
      : newBalance < Number(agreement.originalAmount)
      ? AgreementStatus.PARTIAL
      : agreement.status === AgreementStatus.OVERDUE
      ? AgreementStatus.OVERDUE
      : AgreementStatus.OPEN;

    await tx.personalAgreement.update({
      where: { id: input.agreementId },
      data: {
        currentBalance: newBalance,
        status: newStatus,
        ...(newBalance <= 0 ? { closedAt: new Date() } : {}),
      },
    });
  });

  return getAgreement(userProfileId, input.agreementId);
}
