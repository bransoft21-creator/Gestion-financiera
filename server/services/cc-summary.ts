import { AccountType, TransactionOrigin, TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertHouseholdAccess } from "./households";
import { toFiniteNumber } from "./financial-ledger";

export type CCSummary = {
  id: string;
  name: string;
  currency: string;
  currentBalance: number;
  lastImportDate: string | null;
  importedCount: number;
};

export async function listCCAccountSummaries(
  userProfileId: string,
  householdId: string,
): Promise<CCSummary[]> {
  await assertHouseholdAccess(userProfileId, householdId);

  const accounts = await prisma.account.findMany({
    where: {
      householdId,
      type: AccountType.CREDIT_CARD,
      isArchived: false,
      deletedAt: null,
      OR: [
        { currentBalance: { lt: 0 } },
        {
          transactions: {
            some: { origin: TransactionOrigin.CARD_SUMMARY, deletedAt: null },
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      currency: true,
      currentBalance: true,
      transactions: {
        where: {
          origin: TransactionOrigin.CARD_SUMMARY,
          status: { not: TransactionStatus.CANCELED },
          deletedAt: null,
        },
        select: { id: true, occurredAt: true },
        orderBy: { occurredAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    currency: account.currency,
    currentBalance: toFiniteNumber(account.currentBalance),
    lastImportDate: account.transactions[0]?.occurredAt?.toISOString() ?? null,
    importedCount: account.transactions.length,
  }));
}
