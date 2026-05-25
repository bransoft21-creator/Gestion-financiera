import { TransactionStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { assertHouseholdAccess } from "./households";
import { computeTransactionBalanceDeltas, toFiniteNumber } from "./financial-ledger";

export type LedgerDiscrepancy = {
  accountId: string;
  accountName: string;
  currency: string;
  storedBalance: number;
  computedBalance: number;
  delta: number;
};

export type LedgerInvariantReport = {
  householdId: string;
  checkedAt: string;
  accountCount: number;
  transactionCount: number;
  discrepancies: LedgerDiscrepancy[];
  isClean: boolean;
};

const TOLERANCE = 0.01;

export async function verifyLedgerInvariant(
  userProfileId: string,
  householdId: string,
): Promise<LedgerInvariantReport> {
  await assertHouseholdAccess(userProfileId, householdId);

  const [accounts, transactions] = await Promise.all([
    prisma.account.findMany({
      where: { householdId, deletedAt: null },
      select: { id: true, name: true, currency: true, currentBalance: true },
    }),
    prisma.transaction.findMany({
      where: {
        householdId,
        deletedAt: null,
        status: { not: TransactionStatus.CANCELED },
      },
      select: {
        type: true,
        status: true,
        accountId: true,
        transferAccountId: true,
        amount: true,
        transferAmount: true,
      },
    }),
  ]);

  const accountIds = new Set(accounts.map((a) => a.id));
  const computed = new Map<string, number>();
  for (const account of accounts) computed.set(account.id, 0);

  for (const tx of transactions) {
    const deltas = computeTransactionBalanceDeltas(tx);
    for (const { accountId, delta } of deltas) {
      if (!accountIds.has(accountId)) continue;
      computed.set(accountId, (computed.get(accountId) ?? 0) + delta);
    }
  }

  const discrepancies: LedgerDiscrepancy[] = [];
  for (const account of accounts) {
    const storedBalance = toFiniteNumber(account.currentBalance);
    const computedBalance = Math.round((computed.get(account.id) ?? 0) * 100) / 100;
    const delta = Math.round((computedBalance - storedBalance) * 100) / 100;
    if (Math.abs(delta) > TOLERANCE) {
      discrepancies.push({
        accountId: account.id,
        accountName: account.name,
        currency: account.currency,
        storedBalance,
        computedBalance,
        delta,
      });
    }
  }

  return {
    householdId,
    checkedAt: new Date().toISOString(),
    accountCount: accounts.length,
    transactionCount: transactions.length,
    discrepancies,
    isClean: discrepancies.length === 0,
  };
}
