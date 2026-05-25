import { AgreementStatus, DebtStatus, HouseholdInviteStatus, Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { argentinaDayStartFromInput, argentinaMonthRangeUtc, formatArgentinaDateInput } from "@/lib/dates";
import { isSmartImportEnabled } from "@/lib/feature-flags";
import { buildNavigationAwareness, type NavigationAwareness } from "@/lib/navigation-awareness";
import { prisma } from "@/lib/prisma";
import { getQualitySignals } from "./data-quality";
import { getPrimaryHousehold } from "./workspace";

export async function getNavigationAwareness(userProfileId: string): Promise<NavigationAwareness> {
  const household = await getPrimaryHousehold(userProfileId);
  const profile = await prisma.userProfile.findUniqueOrThrow({
    where: { id: userProfileId },
    select: { email: true },
  });
  const today = formatArgentinaDateInput();
  const todayStart = argentinaDayStartFromInput(today) ?? new Date();
  const dueSoon = new Date(todayStart.getTime() + 7 * 86_400_000);
  const [year, month] = today.split("-").map(Number);
  const { start: monthStart, end: nextMonthStart } = argentinaMonthRangeUtc(year, month);

  const [
    hasTransactions,
    quality,
    budgetsAtRiskCount,
    recurringDueCount,
    debtsDueCount,
    openSharedItems,
    pendingHouseholdInvites,
    unreadActivityCount,
    overdueAgreementsCount,
  ] = await Promise.all([
    prisma.transaction.count({
      where: {
        householdId: household.id,
        deletedAt: null,
        status: { not: TransactionStatus.CANCELED },
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
      },
    }).then((count) => count > 0),
    getQualitySignals(userProfileId, household.id),
    countBudgetsAtRisk(household.id, year, month, monthStart, nextMonthStart),
    prisma.recurringExpense.count({
      where: {
        householdId: household.id,
        isActive: true,
        deletedAt: null,
        nextDueDate: { gte: todayStart, lte: dueSoon },
        OR: [{ endDate: null }, { endDate: { gte: todayStart } }],
      },
    }),
    prisma.debt.count({
      where: {
        householdId: household.id,
        status: { in: [DebtStatus.ACTIVE, DebtStatus.DEFAULTED] },
        outstandingAmount: { gt: 0 },
        deletedAt: null,
        nextDueDate: { gte: todayStart, lte: dueSoon },
      },
    }),
    prisma.sharedTransactionParticipant.count({
      where: {
        userId: userProfileId,
        status: "OPEN",
        sharedTransaction: {
          household: { deletedAt: null },
        },
      },
    }),
    prisma.householdInvite.count({
      where: {
        email: { equals: profile.email, mode: "insensitive" },
        status: HouseholdInviteStatus.PENDING,
      },
    }),
    prisma.activityItem.count({
      where: {
        userId: userProfileId,
        readAt: null,
        dismissedAt: null,
        resolvedAt: null,
      },
    }),
    prisma.personalAgreement.count({
      where: {
        householdId: household.id,
        deletedAt: null,
        status: AgreementStatus.OVERDUE,
      },
    }),
  ]);

  return buildNavigationAwareness({
    canSmartImport: isSmartImportEnabled(profile.email),
    hasTransactions,
    uncategorizedCount: quality.uncategorizedCount,
    frequentGroupCount: quality.frequentGroupCount,
    budgetsAtRiskCount,
    recurringDueCount,
    debtsDueCount,
    openSharedItems,
    pendingHouseholdInvites,
    unreadActivityCount,
    overdueAgreementsCount,
  });
}

async function countBudgetsAtRisk(
  householdId: string,
  year: number,
  month: number,
  monthStart: Date,
  nextMonthStart: Date,
) {
  const [budgets, expenses] = await Promise.all([
    prisma.budget.findMany({
      where: { householdId, year, month, deletedAt: null },
      select: { categoryId: true, plannedAmount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        householdId,
        deletedAt: null,
        status: { not: TransactionStatus.CANCELED },
        type: TransactionType.EXPENSE,
        categoryId: { not: null },
        occurredAt: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amount: true },
    }),
  ]);

  const spentByCategory = new Map(
    expenses
      .filter((expense) => Boolean(expense.categoryId))
      .map((expense) => [expense.categoryId, toNumber(expense._sum.amount)]),
  );

  return budgets.filter((budget) => {
    const planned = toNumber(budget.plannedAmount);
    if (planned <= 0) return false;
    const spent = spentByCategory.get(budget.categoryId) ?? 0;
    return spent / planned >= 0.8;
  }).length;
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}
