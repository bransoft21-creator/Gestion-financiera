import { prisma } from "../../lib/prisma";

export async function deleteHouseholdFinancialData(
  householdId: string,
  userProfileId: string,
) {
  await prisma.$transaction([
    // User-scoped data (no householdId FK)
    // Note: aiCopilotMessage omitted — table not yet migrated to production
    prisma.aiUsage.deleteMany({ where: { userId: userProfileId } }),
    prisma.aiFinancialAnalysis.deleteMany({ where: { userId: userProfileId } }),
    prisma.activityItem.deleteMany({ where: { userId: userProfileId } }),

    // Snapshots and import cache
    prisma.smartImportCache.deleteMany({ where: { householdId } }),
    prisma.monthlySnapshot.deleteMany({ where: { householdId } }),

    // Household settlements
    prisma.householdSettlement.deleteMany({ where: { householdId } }),

    // Agreements — leaf nodes first
    prisma.agreementEvent.deleteMany({ where: { agreement: { householdId } } }),
    prisma.personalAgreement.deleteMany({ where: { householdId } }),
    prisma.personContact.deleteMany({ where: { householdId } }),

    // Credit cards — leaf nodes first, then parent
    prisma.cardPayment.deleteMany({ where: { householdId } }),
    prisma.statementTransaction.deleteMany({ where: { householdId } }),
    prisma.cardStatement.deleteMany({ where: { householdId } }),
    prisma.creditCard.deleteMany({ where: { householdId } }),

    // Shared transactions
    prisma.sharedTransactionParticipant.deleteMany({ where: { sharedTransaction: { householdId } } }),
    prisma.sharedTransaction.deleteMany({ where: { householdId } }),

    // Transactions
    prisma.transaction.deleteMany({ where: { householdId } }),

    // Household recurring payments
    prisma.householdRecurringPaymentOccurrence.deleteMany({ where: { recurringPayment: { householdId } } }),
    prisma.householdRecurringPaymentParticipant.deleteMany({ where: { recurringPayment: { householdId } } }),
    prisma.householdRecurringPayment.deleteMany({ where: { householdId } }),

    // Recurring expenses — occurrences before parent
    prisma.recurringExpenseOccurrence.deleteMany({ where: { recurringExpense: { householdId } } }),
    prisma.recurringExpense.deleteMany({ where: { householdId } }),

    // Financial entities
    prisma.debt.deleteMany({ where: { householdId } }),
    prisma.goal.deleteMany({ where: { householdId } }),
    prisma.budget.deleteMany({ where: { householdId } }),

    // Investments
    prisma.investmentTransaction.deleteMany({ where: { householdId } }),
    prisma.investmentAsset.deleteMany({ where: { householdId } }),
    prisma.investmentAccount.deleteMany({ where: { householdId } }),

    // Accounts and categories — last, after all FK references cleared
    prisma.account.deleteMany({ where: { householdId } }),
    prisma.category.deleteMany({ where: { householdId } }),
  ]);
}
