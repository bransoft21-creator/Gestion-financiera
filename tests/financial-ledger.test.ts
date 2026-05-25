import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AccountType, DebtStatus, DebtType, TransactionStatus, TransactionType } from "@prisma/client";
import {
  computeAccountSummary,
  computeAvailableMoney,
  computeBudgetReservation,
  computeDebtPaymentResult,
  computeFinancialHealth,
  computeMonthlyDebtPayment,
  computeRealLiabilitySummary,
  getDebtPaymentAmountError,
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

  it("computes real liabilities without paid/canceled debt or duplicated credit cards", () => {
    const summary = computeRealLiabilitySummary(
      [
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
      ],
      [
        {
          type: DebtType.CREDIT_CARD,
          status: DebtStatus.ACTIVE,
          outstandingAmount: 25_000,
        },
        {
          type: DebtType.LOAN,
          status: DebtStatus.ACTIVE,
          outstandingAmount: 80_000,
        },
        {
          type: DebtType.LOAN,
          status: DebtStatus.PAID,
          outstandingAmount: 12_000,
        },
        {
          type: DebtType.OTHER,
          status: DebtStatus.CANCELED,
          outstandingAmount: 7_000,
        },
      ],
    );

    assert.deepEqual(summary, {
      assets: 120_000,
      accountLiabilities: 25_000,
      debtLiabilities: 80_000,
      duplicatedCreditCardDebt: 25_000,
      liabilities: 105_000,
      netWorth: 15_000,
    });
  });

  it("keeps a negative paid-off card out of debt when both balances are zero", () => {
    const summary = computeRealLiabilitySummary(
      [
        {
          type: AccountType.CREDIT_CARD,
          currentBalance: 0,
          isArchived: false,
          deletedAt: null,
        },
      ],
      [
        {
          type: DebtType.CREDIT_CARD,
          status: DebtStatus.PAID,
          outstandingAmount: 0,
        },
      ],
    );

    assert.equal(summary.liabilities, 0);
    assert.equal(summary.netWorth, 0);
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

  it("computes the official dashboard financial health formula", () => {
    assert.deepEqual(
      computeFinancialHealth({
        income: 500_000,
        expenses: 180_000,
        budgets: [
          { plannedAmount: 100_000, spentAmount: 65_000 },
          { plannedAmount: 20_000, spentAmount: 25_000 },
        ],
        recurringExpenses: [{ amount: 50_000 }],
        goals: [{ requiredMonthlyAmount: 30_000 }, { requiredMonthlyAmount: null }],
        debts: [
          { minimumPayment: 40_000, outstandingAmount: 150_000 },
          { minimumPayment: null, outstandingAmount: 12_000 },
        ],
        totalOutstandingDebt: 162_000,
      }),
      {
        income: 500_000,
        expenses: 180_000,
        balance: 320_000,
        estimatedSavings: 320_000,
        savingsRate: 64,
        totalBudgeted: 120_000,
        budgetedSpent: 90_000,
        remainingReservedBudget: 35_000,
        upcomingRecurringExpenses: 50_000,
        requiredGoalContributions: 30_000,
        upcomingDebtPayments: 52_000,
        interpersonalToPay: 0,
        upcomingObligations: 132_000,
        realAvailable: 153_000,
        totalOutstandingDebt: 162_000,
      },
    );
  });

  it("keeps budget reservation and debt payment bounded", () => {
    assert.equal(computeBudgetReservation({ plannedAmount: 10_000, spentAmount: 0 }), 10_000);
    assert.equal(computeBudgetReservation({ plannedAmount: 10_000, spentAmount: 12_500 }), 0);
    assert.equal(computeMonthlyDebtPayment({ minimumPayment: 20_000, outstandingAmount: 8_000 }), 8_000);
    assert.equal(computeMonthlyDebtPayment({ minimumPayment: null, outstandingAmount: 8_000 }), 8_000);
  });

  it("does not let over-budget categories or overpaid debt inflate available money", () => {
    const health = computeFinancialHealth({
      income: 100_000,
      expenses: 120_000,
      budgets: [{ plannedAmount: 50_000, spentAmount: 75_000 }],
      recurringExpenses: [],
      goals: [],
      debts: [{ minimumPayment: 25_000, outstandingAmount: 10_000 }],
      totalOutstandingDebt: 10_000,
    });

    assert.equal(health.remainingReservedBudget, 0);
    assert.equal(health.upcomingDebtPayments, 10_000);
    assert.equal(health.realAvailable, -30_000);
    assert.equal(health.savingsRate, 0);
  });

  it("computes partial debt payments and paid status", () => {
    assert.deepEqual(
      computeDebtPaymentResult({
        originalAmount: 80_000,
        outstandingAmount: 80_000,
        paymentAmount: 15_000,
      }),
      {
        outstandingAmount: 65_000,
        paidPercent: 18.75,
        isPaid: false,
      },
    );

    assert.deepEqual(
      computeDebtPaymentResult({
        originalAmount: 80_000,
        outstandingAmount: 15_000.5,
        paymentAmount: 15_000.5,
      }),
      {
        outstandingAmount: 0,
        paidPercent: 100,
        isPaid: true,
      },
    );
  });

  it("validates debt payment limits", () => {
    assert.equal(getDebtPaymentAmountError(0, 80_000), "Ingresá un monto mayor a cero.");
    assert.equal(getDebtPaymentAmountError(-1, 80_000), "Ingresá un monto mayor a cero.");
    assert.equal(
      getDebtPaymentAmountError(80_000.01, 80_000),
      "El pago no puede superar el saldo pendiente (80000.00).",
    );
    assert.equal(getDebtPaymentAmountError(15_000.5, 80_000), null);
  });
});
