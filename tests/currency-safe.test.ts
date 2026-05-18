import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sumByCurrency } from "../lib/finance/currency-safe";
import { computeWeeklyMetrics } from "../lib/finance/financial-analytics";

describe("multi-currency truth layer", () => {
  it("groups money by real currency instead of summing silently", () => {
    const totals = sumByCurrency(
      [
        { currency: "ARS", amount: 120_000 },
        { currency: "USD", amount: 300 },
        { currency: "ARS", amount: 30_000 },
      ],
      (item) => item.currency,
      (item) => item.amount,
    );

    assert.deepEqual(totals, [
      { currency: "ARS", amount: 150_000, count: 2 },
      { currency: "USD", amount: 300, count: 1 },
    ]);
  });

  it("computes weekly metrics only in the requested primary currency", () => {
    const txs = [
      tx({ type: "INCOME", currency: "ARS", amount: 500_000 }),
      tx({ type: "EXPENSE", currency: "ARS", amount: 120_000, category: "Supermercado" }),
      tx({ type: "EXPENSE", currency: "USD", amount: 900, category: "Viaje" }),
    ];

    const metrics = computeWeeklyMetrics(txs, "ARS");

    assert.equal(metrics.currency, "ARS");
    assert.equal(metrics.totalIncome, 500_000);
    assert.equal(metrics.totalExpenses, 120_000);
    assert.equal(metrics.balance, 380_000);
    assert.equal(metrics.mixedCurrencies, true);
    assert.deepEqual(metrics.ignoredCurrencies, ["USD"]);
    assert.deepEqual(metrics.totalsByCurrency, [
      { currency: "ARS", amount: 620_000, count: 2 },
      { currency: "USD", amount: 900, count: 1 },
    ]);
    assert.equal(metrics.topCategory?.name, "Supermercado");
  });
});

function tx(input: {
  type: "INCOME" | "EXPENSE";
  currency: "ARS" | "USD";
  amount: number;
  category?: string;
}) {
  return {
    type: input.type,
    status: "CONFIRMED",
    currency: input.currency,
    amount: input.amount,
    occurredAt: new Date("2026-05-12T12:00:00Z"),
    paymentMethod: null,
    category: input.category ? { name: input.category, type: "EXPENSE" } : null,
    account: { name: "Cuenta", type: "BANK" },
  } as never;
}
