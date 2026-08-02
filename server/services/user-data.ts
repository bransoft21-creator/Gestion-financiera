import { prisma } from "../../lib/prisma";

export async function deleteHouseholdFinancialData(
  householdId: string,
  userProfileId: string,
) {
  await prisma.$transaction(async (tx) => {
    // User-scoped data (no householdId FK)
    await tx.aiCopilotMessage.deleteMany({ where: { householdId } });
    await tx.aiUsage.deleteMany({ where: { userId: userProfileId } });
    await tx.aiFinancialAnalysis.deleteMany({ where: { userId: userProfileId } });
    await tx.activityItem.deleteMany({ where: { userId: userProfileId } });

    // Snapshots and import cache
    await tx.smartImportCache.deleteMany({ where: { householdId } });
    await tx.monthlySnapshot.deleteMany({ where: { householdId } });

    // Household settlements
    await tx.householdSettlement.deleteMany({ where: { householdId } });

    // Agreements — leaf nodes first
    await tx.agreementEvent.deleteMany({ where: { agreement: { householdId } } });
    await tx.personalAgreement.deleteMany({ where: { householdId } });
    await tx.personContact.deleteMany({ where: { householdId } });

    // Credit cards — leaf nodes first, then parent
    await tx.cardPayment.deleteMany({ where: { householdId } });
    await tx.statementTransaction.deleteMany({ where: { householdId } });
    await tx.cardStatement.deleteMany({ where: { householdId } });
    await tx.creditCard.deleteMany({ where: { householdId } });

    // Shared transactions — incluye las de otros hogares que referencian transacciones personales
    await tx.sharedTransactionParticipant.deleteMany({
      where: {
        sharedTransaction: {
          OR: [
            { householdId },
            { transaction: { householdId } },
          ],
        },
      },
    });
    await tx.sharedTransaction.deleteMany({
      where: {
        OR: [
          { householdId },
          { transaction: { householdId } },
        ],
      },
    });

    // Transactions
    await tx.transaction.deleteMany({ where: { householdId } });

    // Household recurring payments
    await tx.householdRecurringPaymentOccurrence.deleteMany({ where: { recurringPayment: { householdId } } });
    await tx.householdRecurringPaymentParticipant.deleteMany({ where: { recurringPayment: { householdId } } });
    await tx.householdRecurringPayment.deleteMany({ where: { householdId } });

    // Recurring expenses — occurrences before parent
    await tx.recurringExpenseOccurrence.deleteMany({ where: { recurringExpense: { householdId } } });
    await tx.recurringExpense.deleteMany({ where: { householdId } });

    // Financial entities
    await tx.debt.deleteMany({ where: { householdId } });
    await tx.goal.deleteMany({ where: { householdId } });
    await tx.budget.deleteMany({ where: { householdId } });

    // Investments
    await tx.investmentTransaction.deleteMany({ where: { householdId } });
    await tx.investmentAsset.deleteMany({ where: { householdId } });
    await tx.investmentAccount.deleteMany({ where: { householdId } });

    // Accounts and categories — last, after all FK references cleared
    await tx.account.deleteMany({ where: { householdId } });
    await tx.category.deleteMany({ where: { householdId } });
  }, { timeout: 30000 });
}
