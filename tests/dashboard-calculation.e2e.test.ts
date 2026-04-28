import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TransactionStatus, TransactionType } from "@prisma/client";
import {
  computeFinancialHealth,
  computeTransactionBalanceDeltas,
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
});
