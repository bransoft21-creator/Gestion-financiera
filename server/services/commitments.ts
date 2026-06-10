import { DebtStatus, HouseholdKind, HouseholdMemberStatus } from "@prisma/client";
import { argentinaMonthKey, argentinaDayMonthYear } from "@/lib/dates";
import { prisma } from "../../lib/prisma";
import { assertHouseholdAccess } from "./households";

export type CommitmentStatus = "PAID" | "PENDING" | "OVERDUE";
export type CommitmentKind = "recurring" | "debt" | "household_recurring";

export type CommitmentItem = {
  id: string;
  kind: CommitmentKind;
  name: string;
  currency: string;
  amount: number;
  dueDay: number | null;
  dueDate: string | null;
  status: CommitmentStatus;
  category: { id: string; name: string; color?: string | null } | null;
  account: { id: string; name: string } | null;
  recurringExpenseId?: string;
  debtId?: string;
  debtType?: string;
  debtOutstandingAmount?: number;
  householdPaymentId?: string;
};

export type CommitmentsSummary = {
  totalItems: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  currency: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
};

const STATUS_ORDER: Record<CommitmentStatus, number> = {
  OVERDUE: 0,
  PENDING: 1,
  PAID: 2,
};

export async function getCommitments(
  userProfileId: string,
  householdId: string,
  monthKey?: string,
) {
  await assertHouseholdAccess(userProfileId, householdId);

  const resolvedMonthKey = monthKey ?? argentinaMonthKey(new Date());
  const [year, month] = resolvedMonthKey.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const now = new Date();
  const currentMonthKey = argentinaMonthKey(now);
  const { day: todayDay } = argentinaDayMonthYear(now);

  const items: CommitmentItem[] = [];

  // 1. Recurring personal expenses active and due in/before this month
  const recurringExpenses = await prisma.recurringExpense.findMany({
    where: {
      householdId,
      deletedAt: null,
      isActive: true,
      nextDueDate: { lt: monthEnd },
    },
    include: {
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, color: true } },
      occurrences: {
        where: { monthKey: resolvedMonthKey },
        take: 1,
        select: { status: true, finalAmount: true },
      },
    },
    orderBy: { nextDueDate: "asc" },
  });

  for (const r of recurringExpenses) {
    const occurrence = r.occurrences[0] ?? null;
    let status: CommitmentStatus;
    if (occurrence?.status === "PAID") {
      status = "PAID";
    } else {
      const isOverdue =
        resolvedMonthKey < currentMonthKey ||
        (resolvedMonthKey === currentMonthKey && new Date(r.nextDueDate) < now);
      status = isOverdue ? "OVERDUE" : "PENDING";
    }
    items.push({
      id: `recurring-${r.id}`,
      kind: "recurring",
      name: r.name,
      currency: r.currency,
      amount: occurrence?.finalAmount ? Number(occurrence.finalAmount) : Number(r.amount),
      dueDay: new Date(r.nextDueDate).getUTCDate(),
      dueDate: r.nextDueDate.toISOString(),
      status,
      category: r.category,
      account: r.account,
      recurringExpenseId: r.id,
    });
  }

  // 2. Debts with nextDueDate due in/before this month
  const debts = await prisma.debt.findMany({
    where: {
      householdId,
      deletedAt: null,
      status: { in: [DebtStatus.ACTIVE, DebtStatus.DEFAULTED] },
      nextDueDate: { not: null, lt: monthEnd },
    },
    select: {
      id: true,
      name: true,
      currency: true,
      outstandingAmount: true,
      minimumPayment: true,
      nextDueDate: true,
      dueDay: true,
      type: true,
      account: { select: { id: true, name: true } },
      transactions: {
        where: {
          type: "DEBT_PAYMENT",
          status: "CONFIRMED",
          occurredAt: { gte: monthStart, lt: monthEnd },
        },
        take: 1,
        select: { id: true },
      },
    },
    orderBy: { nextDueDate: "asc" },
  });

  for (const d of debts) {
    const hasPaid = d.transactions.length > 0;
    let status: CommitmentStatus;
    if (hasPaid) {
      status = "PAID";
    } else if (
      d.nextDueDate &&
      (resolvedMonthKey < currentMonthKey || d.nextDueDate < now)
    ) {
      status = "OVERDUE";
    } else {
      status = "PENDING";
    }
    const payAmount = d.minimumPayment
      ? Number(d.minimumPayment)
      : Number(d.outstandingAmount);
    items.push({
      id: `debt-${d.id}`,
      kind: "debt",
      name: d.name,
      currency: d.currency,
      amount: payAmount,
      dueDay: d.dueDay ?? (d.nextDueDate ? new Date(d.nextDueDate).getUTCDate() : null),
      dueDate: d.nextDueDate?.toISOString() ?? null,
      status,
      category: null,
      account: d.account ?? null,
      debtId: d.id,
      debtType: d.type,
      debtOutstandingAmount: Number(d.outstandingAmount),
    });
  }

  // 3. Shared household recurring payments (if the user belongs to one)
  const sharedHousehold = await prisma.household.findFirst({
    where: {
      kind: HouseholdKind.HOUSEHOLD,
      deletedAt: null,
      members: {
        some: { userProfileId, status: HouseholdMemberStatus.ACTIVE, deletedAt: null },
      },
    },
    select: { id: true },
  });

  if (sharedHousehold) {
    const householdPayments = await prisma.householdRecurringPayment.findMany({
      where: { householdId: sharedHousehold.id, isActive: true, deletedAt: null },
      orderBy: [{ dueDay: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        currency: true,
        estimatedAmount: true,
        dueDay: true,
        category: { select: { id: true, name: true, color: true } },
        occurrences: {
          where: { monthKey: resolvedMonthKey },
          take: 1,
          select: { status: true, finalAmount: true },
        },
      },
    });

    for (const p of householdPayments) {
      const occurrence = p.occurrences[0] ?? null;
      let status: CommitmentStatus;
      if (occurrence?.status === "PAID") {
        status = "PAID";
      } else {
        const isOverdue =
          resolvedMonthKey < currentMonthKey ||
          (resolvedMonthKey === currentMonthKey && todayDay > p.dueDay);
        status = isOverdue ? "OVERDUE" : "PENDING";
      }
      items.push({
        id: `household-${p.id}`,
        kind: "household_recurring",
        name: p.name,
        currency: p.currency,
        amount: occurrence?.finalAmount ? Number(occurrence.finalAmount) : Number(p.estimatedAmount),
        dueDay: p.dueDay,
        dueDate: null,
        status,
        category: p.category ?? null,
        account: null,
        householdPaymentId: p.id,
      });
    }
  }

  items.sort((a, b) => {
    const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (sd !== 0) return sd;
    return (a.dueDay ?? 99) - (b.dueDay ?? 99);
  });

  const arsPrimaryItems = items.filter((i) => i.currency === "ARS");
  const summary: CommitmentsSummary = {
    totalItems: items.length,
    paidCount: items.filter((i) => i.status === "PAID").length,
    pendingCount: items.filter((i) => i.status === "PENDING").length,
    overdueCount: items.filter((i) => i.status === "OVERDUE").length,
    currency: "ARS",
    totalAmount: arsPrimaryItems.reduce((s, i) => s + i.amount, 0),
    paidAmount: arsPrimaryItems.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amount, 0),
    pendingAmount: arsPrimaryItems.filter((i) => i.status === "PENDING").reduce((s, i) => s + i.amount, 0),
    overdueAmount: arsPrimaryItems.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + i.amount, 0),
  };

  return { items, summary, monthKey: resolvedMonthKey };
}
