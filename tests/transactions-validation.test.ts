import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextArgentinaDayStart } from "../lib/dates";
import { createTransactionSchema, listTransactionsSchema } from "../server/schemas/transactions";

describe("transaction validation", () => {
  const base = {
    householdId: "household-1",
    accountId: "account-1",
    amount: "123.45",
    occurredAt: "2026-03-15",
    description: "Movimiento de prueba",
  };

  it("preserves the entered transaction date instead of replacing it with today", () => {
    const parsed = createTransactionSchema.parse({
      ...base,
      type: "EXPENSE",
    });

    assert.equal(parsed.occurredAt.toISOString(), "2026-03-15T12:00:00.000Z");
  });

  it("accepts income, expense, transfer and adjustment creations", () => {
    const income = createTransactionSchema.parse({ ...base, type: "INCOME" });
    const expense = createTransactionSchema.parse({ ...base, type: "EXPENSE" });
    const transfer = createTransactionSchema.parse({
      ...base,
      type: "TRANSFER",
      transferAccountId: "account-2",
    });
    const adjustment = createTransactionSchema.parse({ ...base, type: "ADJUSTMENT" });

    assert.equal(income.type, "INCOME");
    assert.equal(expense.type, "EXPENSE");
    assert.equal(transfer.transferAccountId, "account-2");
    assert.equal(adjustment.type, "ADJUSTMENT");
  });

  it("treats blank optional transaction metadata as omitted", () => {
    const parsed = createTransactionSchema.parse({
      ...base,
      type: "EXPENSE",
      expenseType: null,
      paymentMethod: "",
      installmentNumber: null,
      totalInstallments: "",
    });

    assert.equal(parsed.expenseType, undefined);
    assert.equal(parsed.paymentMethod, undefined);
    assert.equal(parsed.installmentNumber, undefined);
    assert.equal(parsed.totalInstallments, undefined);
  });

  it("keeps amount 0 invalid with a field-level issue", () => {
    const parsed = createTransactionSchema.safeParse({
      ...base,
      type: "EXPENSE",
      amount: "0",
    });

    assert.equal(parsed.success, false);
    if (parsed.success) return;
    assert.equal(parsed.error.issues[0].path[0], "amount");
  });

  it("rejects invalid debt payment transaction status", () => {
    const parsed = createTransactionSchema.safeParse({
      ...base,
      type: "DEBT_PAYMENT",
      status: "COMPLETED",
      debtId: "debt-1",
    });

    assert.equal(parsed.success, false);
  });

  it("normalizes date filters to Argentina calendar days", () => {
    const parsed = listTransactionsSchema.parse({
      householdId: "household-1",
      from: "2026-03-01",
      to: "2026-03-31",
    });

    assert.equal(parsed.from?.toISOString(), "2026-03-01T03:00:00.000Z");
    assert.equal(parsed.to?.toISOString(), "2026-03-31T03:00:00.000Z");
    assert.equal(nextArgentinaDayStart(parsed.to!).toISOString(), "2026-04-01T03:00:00.000Z");
  });
});
