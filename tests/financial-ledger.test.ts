import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AccountType, TransactionStatus, TransactionType } from "@prisma/client";
import {
  computeAccountSummary,
  computeAvailableMoney,
  computeTransactionBalanceDeltas,
  computeTransactionLinkedEntityEffects,
  reverseBalanceDeltas,
} from "../server/services/financial-ledger";

describe("financial ledger", () => {
  it("computes signed account summary with negative balances as liabilities", () => {
    const summary = computeAccountSummary([
      {
        type: AccountType.BANK,
        currentBalance: 120_000,
        isArchived: false,
        deletedAt: null,
      },
      {
        type: AccountType.CREDIT_CARD,
        currentBalance: -25_000,
        isArchived: false,
        deletedAt: null,
      },
      {
        type: AccountType.CASH,
        currentBalance: 8_000,
        isArchived: true,
        deletedAt: null,
      },
    ]);

    assert.deepEqual(summary, {
      assets: 120_000,
      liabilities: 25_000,
      netWorth: 95_000,
    });
  });

  it("moves transfer money out of origin and into destination", () => {
    const deltas = computeTransactionBalanceDeltas({
      type: TransactionType.TRANSFER,
      status: TransactionStatus.CONFIRMED,
      accountId: "bank",
      transferAccountId: "credit-card",
      amount: 10_000,
    });

    assert.deepEqual(deltas, [
      { accountId: "bank", delta: -10_000 },
      { accountId: "credit-card", delta: 10_000 },
    ]);
    assert.deepEqual(reverseBalanceDeltas(deltas), [
      { accountId: "bank", delta: 10_000 },
      { accountId: "credit-card", delta: -10_000 },
    ]);
  });

  it("ignores canceled transactions for balances and linked entities", () => {
    assert.deepEqual(
      computeTransactionBalanceDeltas({
        type: TransactionType.EXPENSE,
        status: TransactionStatus.CANCELED,
        accountId: "cash",
        amount: 500,
      }),
      [],
    );

    assert.deepEqual(
      computeTransactionLinkedEntityEffects({
        type: TransactionType.GOAL_CONTRIBUTION,
        status: TransactionStatus.CANCELED,
        goalId: "goal",
        amount: 500,
      }),
      { debtId: null, debtDelta: 0, goalId: null, goalDelta: 0 },
    );
  });

  it("computes linked entity effects for debt payments and goal contributions", () => {
    assert.deepEqual(
      computeTransactionLinkedEntityEffects({
        type: TransactionType.DEBT_PAYMENT,
        status: TransactionStatus.CONFIRMED,
        debtId: "debt",
        amount: 7_500,
      }),
      { debtId: "debt", debtDelta: -7_500, goalId: null, goalDelta: 0 },
    );

    assert.deepEqual(
      computeTransactionLinkedEntityEffects({
        type: TransactionType.GOAL_CONTRIBUTION,
        status: TransactionStatus.CONFIRMED,
        goalId: "goal",
        amount: 12_000,
      }),
      { debtId: null, debtDelta: 0, goalId: "goal", goalDelta: 12_000 },
    );
  });

  it("subtracts reserved budget and monthly obligations from real available money", () => {
    assert.deepEqual(
      computeAvailableMoney({
        income: 300_000,
        expenses: 120_000,
        reservedBudget: 50_000,
        recurringExpenses: 30_000,
        requiredGoalContributions: 20_000,
        debtPayments: 15_000,
      }),
      {
        balance: 180_000,
        upcomingObligations: 65_000,
        realAvailable: 65_000,
      },
    );
  });
});
