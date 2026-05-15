import { handleApiError } from "../../../../server/api/http";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { prisma } from "../../../../lib/prisma";
import { HouseholdKind, HouseholdMemberStatus } from "@prisma/client";
import { toFiniteNumber } from "../../../../server/services/financial-ledger";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { userProfile } = await getCurrentUser();

    const membership = await prisma.householdMember.findFirst({
      where: {
        userProfileId: userProfile.id,
        status: HouseholdMemberStatus.ACTIVE,
        deletedAt: null,
        household: { kind: HouseholdKind.PERSONAL, deletedAt: null },
      },
      select: {
        householdId: true,
        household: { select: { id: true, name: true, defaultCurrency: true, createdAt: true } },
      },
    });

    const householdId = membership?.householdId;

    const [
      accounts,
      categories,
      transactions,
      budgets,
      goals,
      debts,
      recurringExpenses,
      householdPayments,
      settlements,
      activityItems,
    ] = await Promise.all([
      householdId
        ? prisma.account.findMany({
            where: { householdId, deletedAt: null },
            select: { id: true, name: true, type: true, currency: true, currentBalance: true, openingBalance: true, creditLimit: true, isArchived: true, createdAt: true },
            orderBy: { name: "asc" },
          })
        : [],
      householdId
        ? prisma.category.findMany({
            where: { householdId, deletedAt: null },
            select: { id: true, name: true, type: true, color: true, icon: true, isSystem: true, isArchived: true },
            orderBy: { name: "asc" },
          })
        : [],
      householdId
        ? prisma.transaction.findMany({
            where: { householdId, deletedAt: null },
            select: {
              id: true, type: true, status: true, currency: true, amount: true, description: true,
              occurredAt: true, expenseType: true, isRecurring: true, isInstallment: true,
              accountId: true, categoryId: true,
              account: { select: { name: true } },
              category: { select: { name: true } },
            },
            orderBy: { occurredAt: "desc" },
          })
        : [],
      householdId
        ? prisma.budget.findMany({
            where: { householdId, deletedAt: null },
            select: { id: true, year: true, month: true, currency: true, plannedAmount: true, period: true, category: { select: { name: true } } },
          })
        : [],
      householdId
        ? prisma.goal.findMany({
            where: { householdId, deletedAt: null },
            select: { id: true, name: true, currency: true, targetAmount: true, currentAmount: true, status: true, targetDate: true, notes: true, createdAt: true },
          })
        : [],
      householdId
        ? prisma.debt.findMany({
            where: { householdId, deletedAt: null },
            select: { id: true, name: true, lender: true, type: true, status: true, currency: true, originalAmount: true, outstandingAmount: true, minimumPayment: true, interestRate: true, nextDueDate: true, notes: true, createdAt: true },
          })
        : [],
      householdId
        ? prisma.recurringExpense.findMany({
            where: { householdId, deletedAt: null },
            select: { id: true, name: true, currency: true, amount: true, frequency: true, nextDueDate: true, isActive: true, notes: true, category: { select: { name: true } } },
          })
        : [],
      householdId
        ? prisma.householdRecurringPayment.findMany({
            where: { householdId, deletedAt: null },
            select: { id: true, name: true, currency: true, estimatedAmount: true, dueDay: true, splitMode: true, isActive: true, category: { select: { name: true } } },
          })
        : [],
      householdId
        ? prisma.householdSettlement.findMany({
            where: { householdId },
            select: { id: true, amount: true, notes: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          })
        : [],
      prisma.activityItem.findMany({
        where: { userId: userProfile.id },
        select: { id: true, type: true, title: true, body: true, tone: true, readAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);

    const exportDate = new Date().toISOString().slice(0, 10);

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: "1.0",
      user: {
        email: userProfile.email,
        fullName: userProfile.fullName,
        currency: userProfile.currency,
        locale: userProfile.locale,
        timezone: userProfile.timezone,
      },
      household: membership?.household ?? null,
      accounts: accounts.map((a) => ({
        ...a,
        currentBalance: toFiniteNumber(a.currentBalance),
        openingBalance: toFiniteNumber(a.openingBalance),
        creditLimit: a.creditLimit != null ? toFiniteNumber(a.creditLimit) : null,
      })),
      categories,
      transactions: transactions.map((t) => ({
        ...t,
        amount: toFiniteNumber(t.amount),
        accountName: t.account.name,
        categoryName: t.category?.name ?? null,
        account: undefined,
        category: undefined,
      })),
      budgets: budgets.map((b) => ({
        ...b,
        plannedAmount: toFiniteNumber(b.plannedAmount),
        categoryName: b.category.name,
        category: undefined,
      })),
      goals: goals.map((g) => ({
        ...g,
        targetAmount: toFiniteNumber(g.targetAmount),
        currentAmount: toFiniteNumber(g.currentAmount),
      })),
      debts: debts.map((d) => ({
        ...d,
        originalAmount: toFiniteNumber(d.originalAmount),
        outstandingAmount: toFiniteNumber(d.outstandingAmount),
        minimumPayment: d.minimumPayment != null ? toFiniteNumber(d.minimumPayment) : null,
        interestRate: d.interestRate != null ? toFiniteNumber(d.interestRate) : null,
      })),
      recurringExpenses: recurringExpenses.map((r) => ({
        ...r,
        amount: toFiniteNumber(r.amount),
        categoryName: r.category?.name ?? null,
        category: undefined,
      })),
      householdPayments: householdPayments.map((p) => ({
        ...p,
        estimatedAmount: toFiniteNumber(p.estimatedAmount),
        categoryName: p.category?.name ?? null,
        category: undefined,
      })),
      settlements: settlements.map((s) => ({
        ...s,
        amount: toFiniteNumber(s.amount),
      })),
      activityItems,
    };

    const json = JSON.stringify(exportData, null, 2);
    return new Response(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="meridian-export-${exportDate}.json"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
