import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CurrencyCode, TransactionType } from "@prisma/client";
import { parseMoneyInput } from "../lib/money";
import { handleApiError } from "../server/api/http";
import { createAccountSchema } from "../server/schemas/accounts";
import { createBudgetSchema } from "../server/schemas/budgets";
import { createDebtSchema } from "../server/schemas/debts";
import { createGoalSchema } from "../server/schemas/goals";
import { createRecurringExpenseSchema } from "../server/schemas/recurring-expenses";
import { createTransactionSchema } from "../server/schemas/transactions";

describe("money validation", () => {
  const base = { householdId: "household-1" };

  it("rejects zero where a positive amount is required", () => {
    assert.equal(parseMoneyInput("0").success, false);
    assert.equal(createTransactionSchema.safeParse({
      ...base,
      accountId: "account-1",
      type: TransactionType.EXPENSE,
      amount: "0",
      occurredAt: "2026-04-28",
    }).success, false);
    assert.equal(createBudgetSchema.safeParse({
      ...base,
      categoryId: "category-1",
      year: 2026,
      month: 4,
      plannedAmount: "0",
    }).success, false);
  });

  it("rejects negatives except signed account opening balances", () => {
    assert.equal(createDebtSchema.safeParse({
      ...base,
      name: "Tarjeta",
      type: "CREDIT_CARD",
      originalAmount: "-10",
      outstandingAmount: "10",
    }).success, false);

    const account = createAccountSchema.parse({
      ...base,
      name: "Visa",
      type: "CREDIT_CARD",
      currency: CurrencyCode.ARS,
      openingBalance: "-123.45",
    });

    assert.equal(account.openingBalance, -123.45);
  });

  it("accepts decimals consistently without rounding them before save", () => {
    const transaction = createTransactionSchema.parse({
      ...base,
      accountId: "account-1",
      type: TransactionType.EXPENSE,
      amount: "12.34",
      occurredAt: "2026-04-28",
    });
    const recurring = createRecurringExpenseSchema.parse({
      ...base,
      name: "Servicio",
      amount: "12,34",
      frequency: "MONTHLY",
      nextDueDate: "2026-04-28",
    });

    assert.equal(transaction.amount, 12.34);
    assert.equal(recurring.amount, 12.34);
    assert.equal(createBudgetSchema.parse({
      ...base,
      categoryId: "category-1",
      year: 2026,
      month: 4,
      plannedAmount: "10000.75",
    }).plannedAmount, 10000.75);
    assert.equal(parseMoneyInput("12.345").success, false);
  });

  it("accepts large amounts within the app limit and rejects larger values", () => {
    const goal = createGoalSchema.parse({
      ...base,
      name: "Casa",
      targetAmount: "999999999999.99",
      currentAmount: "0",
    });

    assert.equal(goal.targetAmount, 999999999999.99);
    assert.equal(parseMoneyInput("1000000000000").success, false);
  });

  it("rejects empty required money fields and allows empty optional fields", () => {
    assert.equal(createBudgetSchema.safeParse({
      ...base,
      categoryId: "category-1",
      year: 2026,
      month: 4,
      plannedAmount: "",
    }).success, false);

    const debt = createDebtSchema.parse({
      ...base,
      name: "Prestamo",
      type: "LOAN",
      originalAmount: "1000",
      outstandingAmount: "500.50",
      minimumPayment: undefined,
    });

    assert.equal(debt.minimumPayment, undefined);
  });

  it("returns field errors instead of the generic validation error", async () => {
    const parsed = createBudgetSchema.safeParse({
      ...base,
      categoryId: "",
      year: 2026,
      month: 4,
      plannedAmount: "0",
    });

    assert.equal(parsed.success, false);
    if (parsed.success) return;

    const response = handleApiError(parsed.error);
    const payload = await response.json();

    assert.equal(payload.error, "Revisá los campos marcados.");
    assert.equal(typeof payload.fieldErrors.categoryId, "string");
    assert.equal(payload.fieldErrors.plannedAmount, "Ingresá un monto mayor a cero.");
  });
});
