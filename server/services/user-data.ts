import { prisma } from "../../lib/prisma";

export async function deleteHouseholdFinancialData(
  householdId: string,
  userProfileId: string,
) {
  await prisma.$transaction([
    // User-scoped AI data
    prisma.aiFinancialAnalysis.deleteMany({ where: { userId: userProfileId } }),
    prisma.activityItem.deleteMany({ where: { userId: userProfileId } }),
    // Household-scoped
    prisma.smartImportCache.deleteMany({ where: { householdId } }),
    prisma.monthlySnapshot.deleteMany({ where: { householdId } }),
    // Household settlements
    prisma.householdSettlement.deleteMany({ where: { householdId } }),
    // Shared transactions
    prisma.sharedTransactionParticipant.deleteMany({ where: { sharedTransaction: { householdId } } }),
    prisma.sharedTransaction.deleteMany({ where: { householdId } }),
    // Transactions
    prisma.transaction.deleteMany({ where: { householdId } }),
    // Household recurring payments
    prisma.householdRecurringPaymentOccurrence.deleteMany({ where: { recurringPayment: { householdId } } }),
    prisma.householdRecurringPaymentParticipant.deleteMany({ where: { recurringPayment: { householdId } } }),
    prisma.householdRecurringPayment.deleteMany({ where: { householdId } }),
    // Financial entities
    prisma.recurringExpense.deleteMany({ where: { householdId } }),
    prisma.debt.deleteMany({ where: { householdId } }),
    prisma.goal.deleteMany({ where: { householdId } }),
    prisma.budget.deleteMany({ where: { householdId } }),
    // Investments
    prisma.investmentTransaction.deleteMany({ where: { householdId } }),
    prisma.investmentAsset.deleteMany({ where: { householdId } }),
    prisma.investmentAccount.deleteMany({ where: { householdId } }),
    // Accounts and categories
    prisma.account.deleteMany({ where: { householdId } }),
    prisma.category.deleteMany({ where: { householdId } }),
  ]);
}
