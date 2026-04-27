import { TransactionType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { MonthlyReportInput } from "../schemas/reports";
import { assertHouseholdAccess } from "./households";

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
        deletedAt: null,
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
        occurredAt: { gte: rangeStart, lt: rangeEnd },
      },
      select: { type: true, amount: true, occurredAt: true },
    }),
    prisma.transaction.findMany({
      where: {
        householdId: input.householdId,
        deletedAt: null,
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
      .reduce((s, t) => s + Number(t.amount), 0);

    const expenses = slice
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((s, t) => s + Number(t.amount), 0);

    const savings = Math.max(income - expenses, 0);
    const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

    return { label, year, month, income, expenses, savings, savingsRate };
  });

  const categoryTotals = new Map<string, { name: string; color: string | null; total: number }>();
  let totalExpenses = 0;

  for (const t of categoryTransactions) {
    if (!t.categoryId || !t.category) continue;
    const amount = Number(t.amount);
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
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const label = new Intl.DateTimeFormat("es-AR", { month: "short", year: "2-digit" }).format(d);
    slots.push({ label, year: d.getFullYear(), month: d.getMonth() + 1, start, end });
  }
  return slots;
}
