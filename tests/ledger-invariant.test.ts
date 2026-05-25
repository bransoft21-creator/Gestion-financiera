import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { computeTransactionBalanceDeltas, toFiniteNumber } from "../server/services/financial-ledger";

// Simulates the core reconstruction logic of verifyLedgerInvariant without DB access.
function reconstructBalances(
  accountIds: string[],
  transactions: Parameters<typeof computeTransactionBalanceDeltas>[0][],
): Map<string, number> {
  const ids = new Set(accountIds);
  const computed = new Map<string, number>();
  for (const id of accountIds) computed.set(id, 0);
  for (const tx of transactions) {
    for (const { accountId, delta } of computeTransactionBalanceDeltas(tx)) {
      if (!ids.has(accountId)) continue;
      computed.set(accountId, (computed.get(accountId) ?? 0) + delta);
    }
  }
  return computed;
}

describe("ledger invariant reconstruction", () => {
  it("reconstructs balance correctly from income and expense transactions", () => {
    const computed = reconstructBalances(["bank"], [
      { type: TransactionType.INCOME, status: TransactionStatus.CONFIRMED, accountId: "bank", amount: 100_000 },
      { type: TransactionType.EXPENSE, status: TransactionStatus.CONFIRMED, accountId: "bank", amount: 30_000 },
    ]);
    assert.equal(computed.get("bank"), 70_000);
  });

  it("ignores CANCELED transactions", () => {
    const computed = reconstructBalances(["bank"], [
      { type: TransactionType.INCOME, status: TransactionStatus.CONFIRMED, accountId: "bank", amount: 50_000 },
      { type: TransactionType.EXPENSE, status: TransactionStatus.CANCELED, accountId: "bank", amount: 20_000 },
    ]);
    assert.equal(computed.get("bank"), 50_000);
  });

  it("handles transfers between two accounts", () => {
    const computed = reconstructBalances(["bank", "savings"], [
      { type: TransactionType.INCOME, status: TransactionStatus.CONFIRMED, accountId: "bank", amount: 100_000 },
      {
        type: TransactionType.TRANSFER,
        status: TransactionStatus.CONFIRMED,
        accountId: "bank",
        transferAccountId: "savings",
        amount: 40_000,
        transferAmount: 40_000,
      },
    ]);
    assert.equal(computed.get("bank"), 60_000);
    assert.equal(computed.get("savings"), 40_000);
  });

  it("ignores deltas for accounts outside the household set", () => {
    const computed = reconstructBalances(["bank"], [
      { type: TransactionType.INCOME, status: TransactionStatus.CONFIRMED, accountId: "bank", amount: 80_000 },
      {
        type: TransactionType.TRANSFER,
        status: TransactionStatus.CONFIRMED,
        accountId: "bank",
        transferAccountId: "external-account",
        amount: 20_000,
        transferAmount: 20_000,
      },
    ]);
    assert.equal(computed.get("bank"), 60_000);
    assert.equal(computed.has("external-account"), false);
  });

  it("detects discrepancy when stored balance diverges from computed", () => {
    const computed = reconstructBalances(["bank"], [
      { type: TransactionType.INCOME, status: TransactionStatus.CONFIRMED, accountId: "bank", amount: 100_000 },
    ]);
    const storedBalance = 90_000;
    const computedBalance = computed.get("bank") ?? 0;
    const delta = computedBalance - storedBalance;
    assert.equal(Math.abs(delta) > 0.01, true);
    assert.equal(delta, 10_000);
  });

  it("reports clean when stored balance matches computed within tolerance", () => {
    const computed = reconstructBalances(["bank"], [
      { type: TransactionType.INCOME, status: TransactionStatus.CONFIRMED, accountId: "bank", amount: 100_000 },
      { type: TransactionType.EXPENSE, status: TransactionStatus.CONFIRMED, accountId: "bank", amount: 30_000 },
    ]);
    const storedBalance = 70_000;
    const computedBalance = computed.get("bank") ?? 0;
    const delta = Math.abs(computedBalance - storedBalance);
    assert.equal(delta <= 0.01, true);
  });

  it("handles PERSONAL_LOAN_GIVEN and PERSONAL_LOAN_RETURN symmetrically", () => {
    const computed = reconstructBalances(["bank"], [
      { type: TransactionType.INCOME, status: TransactionStatus.CONFIRMED, accountId: "bank", amount: 100_000 },
      { type: TransactionType.PERSONAL_LOAN_GIVEN, status: TransactionStatus.CONFIRMED, accountId: "bank", amount: 15_000 },
      { type: TransactionType.PERSONAL_LOAN_RETURN, status: TransactionStatus.CONFIRMED, accountId: "bank", amount: 15_000 },
    ]);
    assert.equal(computed.get("bank"), 100_000);
  });
});
