import { Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { ARGENTINA_TIME_ZONE, argentinaMonthStartUtc } from "@/lib/dates";
import { prisma } from "../../lib/prisma";
import type { MonthlyReportInput } from "../schemas/reports";
import { assertHouseholdAccess } from "./households";

const activeTransactionWhere = {
  deletedAt: null,
  status: { not: TransactionStatus.CANCELED },
} satisfies Prisma.TransactionWhereInput;

export async function getMonthlyReport(userProfileId: string, input: MonthlyReportInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const now = new Date();
  const monthSlots = buildMonthSlots(now, input.months);
  const rangeStart = monthSlots[0].start;
  const rangeEnd = monthSlots[monthSlots.length - 1].end;

  const [transactions, categoryTransactions] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        householdId: input.householdId,
        ...activeTransactionWhere,
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
        occurredAt: { gte: rangeStart, lt: rangeEnd },
      },
      select: { type: true, amount: true, occurredAt: true },
    }),
    prisma.transaction.findMany({
      where: {
        householdId: input.householdId,
        ...activeTransactionWhere,
        type: TransactionType.EXPENSE,
        categoryId: { not: null },
        occurredAt: {
          gte: monthSlots[monthSlots.length - 1].start,
          lt: monthSlots[monthSlots.length - 1].end,
        },
      },
      select: { amount: true, categoryId: true, category: { select: { id: true, name: true, color: true } } },
    }),
  ]);

  const trend = monthSlots.map(({ label, year, month, start, end }) => {
    const slice = transactions.filter(
      (t) => t.occurredAt >= start && t.occurredAt < end,
    );

    const income = slice
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((s, t) => s + toFiniteNumber(t.amount), 0);

    const expenses = slice
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((s, t) => s + toFiniteNumber(t.amount), 0);

    const balance = income - expenses;
    const savings = Math.max(balance, 0);
    const savingsRate = income > 0 ? Math.round((Math.max(balance, 0) / income) * 100) : 0;

    return { label, year, month, income, expenses, savings, savingsRate };
  });

  const categoryTotals = new Map<string, { name: string; color: string | null; total: number }>();
  let totalExpenses = 0;

  for (const t of categoryTransactions) {
    if (!t.categoryId || !t.category) continue;
    const amount = toFiniteNumber(t.amount);
    totalExpenses += amount;
    const existing = categoryTotals.get(t.categoryId);
    categoryTotals.set(t.categoryId, {
      name: t.category.name,
      color: t.category.color,
      total: (existing?.total ?? 0) + amount,
    });
  }

  const topCategories = Array.from(categoryTotals.entries())
    .map(([categoryId, data]) => ({
      categoryId,
      name: data.name,
      color: data.color,
      total: data.total,
      percentage: totalExpenses > 0 ? Math.round((data.total / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return { trend, topCategories };
}

function buildMonthSlots(now: Date, months: number) {
  const slots = [];
  const currentPeriod = getArgentinaPeriod(now);

  for (let i = months - 1; i >= 0; i--) {
    const monthIndex = currentPeriod.year * 12 + currentPeriod.month - 1 - i;
    const year = Math.floor(monthIndex / 12);
    const month = monthIndex - year * 12;
    const start = argentinaMonthStartUtc(year, month);
    const end = argentinaMonthStartUtc(year, month + 1);
    const label = new Intl.DateTimeFormat("es-AR", {
      month: "short",
      year: "2-digit",
      timeZone: ARGENTINA_TIME_ZONE,
    }).format(start);

    slots.push({ label, year, month: month + 1, start, end });
  }

  return slots;
}

function getArgentinaPeriod(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    timeZone: ARGENTINA_TIME_ZONE,
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
  };
}

function toFiniteNumber(value: Prisma.Decimal | number) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}
