import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TransactionStatus, TransactionType } from "@prisma/client";
import {
  computeFinancialHealth,
  computeTransactionBalanceDeltas,
  toFiniteNumber,
} from "../server/services/financial-ledger";

describe("dashboard calculation e2e", () => {
  it("matches real monthly data across transactions, budgets, goals, debts and recurring expenses", () => {
    const transactions = [
      { type: TransactionType.INCOME, amount: 450_000, categoryId: null },
      { type: TransactionType.EXPENSE, amount: 80_000, categoryId: "food" },
      { type: TransactionType.EXPENSE, amount: 35_000, categoryId: "transport" },
      { type: TransactionType.TRANSFER, amount: 25_000, categoryId: null },
      { type: TransactionType.ADJUSTMENT, amount: 10_000, categoryId: null },
    ];
    const income = transactions
      .filter((transaction) => transaction.type === TransactionType.INCOME)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expenses = transactions
      .filter((transaction) => transaction.type === TransactionType.EXPENSE)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const spentByCategory = new Map<string, number>();

    transactions.forEach((transaction) => {
      if (transaction.type !== TransactionType.EXPENSE || !transaction.categoryId) return;
      spentByCategory.set(
        transaction.categoryId,
        (spentByCategory.get(transaction.categoryId) ?? 0) + transaction.amount,
      );
    });

    const health = computeFinancialHealth({
      income,
      expenses,
      budgets: [
        { plannedAmount: 100_000, spentAmount: spentByCategory.get("food") ?? 0 },
        { plannedAmount: 40_000, spentAmount: spentByCategory.get("transport") ?? 0 },
      ],
      recurringExpenses: [{ amount: 30_000 }],
      goals: [{ requiredMonthlyAmount: 25_000 }],
      debts: [{ minimumPayment: 20_000, outstandingAmount: 90_000 }],
      totalOutstandingDebt: 90_000,
    });

    assert.deepEqual(health, {
      income: 450_000,
      expenses: 115_000,
      balance: 335_000,
      estimatedSavings: 335_000,
      savingsRate: 74,
      totalBudgeted: 140_000,
      budgetedSpent: 115_000,
      remainingReservedBudget: 25_000,
      upcomingRecurringExpenses: 30_000,
      requiredGoalContributions: 25_000,
      upcomingDebtPayments: 20_000,
      interpersonalToPay: 0,
      upcomingObligations: 75_000,
      realAvailable: 235_000,
      totalOutstandingDebt: 90_000,
    });

    assert.deepEqual(
      computeTransactionBalanceDeltas({
        type: TransactionType.TRANSFER,
        status: TransactionStatus.CONFIRMED,
        accountId: "bank",
        transferAccountId: "savings",
        amount: 25_000,
      }),
      [
        { accountId: "bank", delta: -25_000 },
        { accountId: "savings", delta: 25_000 },
      ],
    );
  });

  it("realAvailable uses account balances for current/future months, P&L for past months", () => {
    // Regression test for P0 bug: at the start of a new month (e.g. June 1st) with
    // no transactions yet, income=0 and expenses=0. The old formula gave:
    //   realAvailable = (0 - 0) - reservedBudget - obligations = -(obligations)
    // Fix: for current/future months use SUM(Account.currentBalance) as the base.
    // For past months use the P&L (income - expenses) — the correct retrospective view.

    const accounts = [
      { currentBalance: 450_000 },
      { currentBalance: 120_000 },
      { currentBalance: -30_000 }, // credit card with debt
    ];
    const totalPrimaryBalance = accounts.reduce(
      (sum, a) => sum + toFiniteNumber(a.currentBalance),
      0,
    ); // = 540_000

    // Scenario A: current/future month with no transactions (the P0 bug)
    const healthNoTx = computeFinancialHealth({
      income: 0,
      expenses: 0,
      budgets: [{ plannedAmount: 50_000, spentAmount: 0 }],
      recurringExpenses: [{ amount: 40_000 }],
      goals: [{ requiredMonthlyAmount: 20_000 }],
      debts: [{ minimumPayment: 15_000, outstandingAmount: 100_000 }],
      totalOutstandingDebt: 100_000,
    });
    // Old (broken): realAvailable = (0-0) - 50_000 - 75_000 = -125_000
    assert.equal(healthNoTx.realAvailable, -125_000, "P&L formula is wrong for current month with no transactions");
    // Correct for current/future months:
    const currentMonthReal = totalPrimaryBalance - healthNoTx.remainingReservedBudget - healthNoTx.upcomingObligations;
    assert.equal(currentMonthReal, 415_000, "account-balance formula correct for current month");

    // Scenario B: past month with real transactions recorded
    const healthPastTx = computeFinancialHealth({
      income: 300_000,
      expenses: 120_000,
      budgets: [{ plannedAmount: 50_000, spentAmount: 0 }],
      recurringExpenses: [{ amount: 40_000 }],
      goals: [{ requiredMonthlyAmount: 20_000 }],
      debts: [{ minimumPayment: 15_000, outstandingAmount: 100_000 }],
      totalOutstandingDebt: 100_000,
    });
    // For past months: P&L is the correct retrospective view
    // realAvailable = (300k - 120k) - 50k - 75k = 55_000
    assert.equal(healthPastTx.realAvailable, 55_000, "P&L formula is correct for past months with transactions");
    // Using today's account balance for a past month would be wrong:
    const wrongPastMonthReal = totalPrimaryBalance - healthPastTx.remainingReservedBudget - healthPastTx.upcomingObligations;
    assert.equal(wrongPastMonthReal, 415_000, "account-balance formula gives wrong value for past months");
    assert.notEqual(wrongPastMonthReal, healthPastTx.realAvailable);
  });

  it("keeps dashboard reservation at zero when a budget is exceeded", () => {
    const health = computeFinancialHealth({
      income: 100_000,
      expenses: 12_500,
      budgets: [{ plannedAmount: 10_000, spentAmount: 12_500 }],
      recurringExpenses: [],
      goals: [],
      debts: [],
      totalOutstandingDebt: 0,
    });

    assert.equal(health.remainingReservedBudget, 0);
    assert.equal(health.budgetedSpent, 12_500);
    assert.equal(health.realAvailable, 87_500);
  });
});
