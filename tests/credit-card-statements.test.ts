import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CardStatementStatus } from "@prisma/client";
import { computeCardStatementPaymentResult } from "../server/services/credit-cards";

describe("credit card statements", () => {
  const baseStatement = {
    status: CardStatementStatus.CLOSED_PENDING_PAYMENT,
    totalAmount: 183_912,
    pendingAmount: 183_912,
    paidAmount: 0,
    minimumPayment: 48_000,
    dueDate: new Date("2026-06-10T12:00:00.000Z"),
  };

  it("keeps a partially paid statement pending with reduced balance", () => {
    const result = computeCardStatementPaymentResult({
      ...baseStatement,
      paymentAmount: 48_000,
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    assert.equal(result.paidAmount, 48_000);
    assert.equal(result.pendingAmount, 135_912);
    assert.equal(result.status, CardStatementStatus.PARTIALLY_PAID);
  });

  it("marks a statement paid when the total balance is covered", () => {
    const result = computeCardStatementPaymentResult({
      ...baseStatement,
      paymentAmount: 183_912,
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    assert.equal(result.paidAmount, 183_912);
    assert.equal(result.pendingAmount, 0);
    assert.equal(result.status, CardStatementStatus.PAID);
  });

  it("keeps unpaid due statements overdue instead of mixing them into history", () => {
    const result = computeCardStatementPaymentResult({
      ...baseStatement,
      pendingAmount: 180_000,
      paidAmount: 3_912,
      paymentAmount: 1_000,
      now: new Date("2026-06-20T12:00:00.000Z"),
    });

    assert.equal(result.pendingAmount, 179_000);
    assert.equal(result.status, CardStatementStatus.OVERDUE);
  });
});
