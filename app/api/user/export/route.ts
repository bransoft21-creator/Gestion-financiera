import { handleApiError } from "../../../../server/api/http";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { prisma } from "../../../../lib/prisma";
import { HouseholdKind, HouseholdMemberStatus } from "@prisma/client";
import { toFiniteNumber } from "../../../../server/services/financial-ledger";
import packageJson from "../../../../package.json";
import {
  buildExportMetadata,
  EXPORT_SCHEMA_VERSION,
  formatTransactionsCsv,
} from "../../../../server/services/export-format";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { userProfile } = await getCurrentUser();
    const url = new URL(request.url);
    const requestedFormat = url.searchParams.get("format");
    const exportFormat = requestedFormat === "transactions-csv" ? "transactions-csv" : "json";

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
    const exportedAt = new Date().toISOString();

    const normalizedAccounts = accounts.map((a) => ({
      ...a,
      currentBalance: toFiniteNumber(a.currentBalance),
      openingBalance: toFiniteNumber(a.openingBalance),
      creditLimit: a.creditLimit != null ? toFiniteNumber(a.creditLimit) : null,
    }));
    const normalizedTransactions = transactions.map((t) => ({
      ...t,
      amount: toFiniteNumber(t.amount),
      accountName: t.account.name,
      categoryName: t.category?.name ?? null,
      account: undefined,
      category: undefined,
    }));
    const normalizedBudgets = budgets.map((b) => ({
      ...b,
      plannedAmount: toFiniteNumber(b.plannedAmount),
      categoryName: b.category.name,
      category: undefined,
    }));
    const normalizedGoals = goals.map((g) => ({
      ...g,
      targetAmount: toFiniteNumber(g.targetAmount),
      currentAmount: toFiniteNumber(g.currentAmount),
    }));
    const normalizedDebts = debts.map((d) => ({
      ...d,
      originalAmount: toFiniteNumber(d.originalAmount),
      outstandingAmount: toFiniteNumber(d.outstandingAmount),
      minimumPayment: d.minimumPayment != null ? toFiniteNumber(d.minimumPayment) : null,
      interestRate: d.interestRate != null ? toFiniteNumber(d.interestRate) : null,
    }));
    const normalizedRecurringExpenses = recurringExpenses.map((r) => ({
      ...r,
      amount: toFiniteNumber(r.amount),
      categoryName: r.category?.name ?? null,
      category: undefined,
    }));
    const normalizedHouseholdPayments = householdPayments.map((p) => ({
      ...p,
      estimatedAmount: toFiniteNumber(p.estimatedAmount),
      categoryName: p.category?.name ?? null,
      category: undefined,
    }));
    const normalizedSettlements = settlements.map((s) => ({
      ...s,
      amount: toFiniteNumber(s.amount),
    }));

    const recordCounts = {
      accounts: normalizedAccounts.length,
      categories: categories.length,
      transactions: normalizedTransactions.length,
      budgets: normalizedBudgets.length,
      goals: normalizedGoals.length,
      debts: normalizedDebts.length,
      recurringExpenses: normalizedRecurringExpenses.length,
      householdPayments: normalizedHouseholdPayments.length,
      settlements: normalizedSettlements.length,
      activityItems: activityItems.length,
    };
    const metadata = buildExportMetadata({
      exportedAt,
      timezone: userProfile.timezone,
      locale: userProfile.locale,
      appVersion: packageJson.version,
      format: exportFormat,
      householdId,
      recordCounts,
    });

    if (exportFormat === "transactions-csv") {
      const csv = formatTransactionsCsv(normalizedTransactions);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="meridian-movimientos-${exportDate}.csv"`,
          "X-Meridian-Export-Schema": EXPORT_SCHEMA_VERSION,
        },
      });
    }

    const exportData = {
      metadata,
      exportedAt,
      exportVersion: EXPORT_SCHEMA_VERSION,
      user: {
        email: userProfile.email,
        fullName: userProfile.fullName,
        currency: userProfile.currency,
        locale: userProfile.locale,
        timezone: userProfile.timezone,
      },
      household: membership?.household ?? null,
      accounts: normalizedAccounts,
      categories,
      transactions: normalizedTransactions,
      budgets: normalizedBudgets,
      goals: normalizedGoals,
      debts: normalizedDebts,
      recurringExpenses: normalizedRecurringExpenses,
      householdPayments: normalizedHouseholdPayments,
      settlements: normalizedSettlements,
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
