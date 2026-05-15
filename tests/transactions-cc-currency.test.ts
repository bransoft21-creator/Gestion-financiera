import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectCurrencyMismatch,
  getHighestDebtCreditCard,
  sortAccountsByCurrency,
} from "../app/(private)/transactions/utils";
import type { AccountOption } from "../app/(private)/transactions/types";

function makeAccount(overrides: Partial<AccountOption> & { id: string }): AccountOption {
  return {
    name: "Test",
    type: "BANK",
    currency: "ARS",
    currentBalance: "0",
    ...overrides,
  };
}

describe("getHighestDebtCreditCard", () => {
  it("selects the card with the largest absolute debt", () => {
    const accounts = [
      makeAccount({ id: "cc-1", type: "CREDIT_CARD", currentBalance: "-5000" }),
      makeAccount({ id: "cc-2", type: "CREDIT_CARD", currentBalance: "-15000" }),
      makeAccount({ id: "cc-3", type: "CREDIT_CARD", currentBalance: "-3000" }),
    ];
    const result = getHighestDebtCreditCard(accounts);
    assert.equal(result?.id, "cc-2");
  });

  it("falls back to the first card when none carry debt", () => {
    const accounts = [
      makeAccount({ id: "cc-1", type: "CREDIT_CARD", currentBalance: "0" }),
      makeAccount({ id: "cc-2", type: "CREDIT_CARD", currentBalance: "500" }),
    ];
    const result = getHighestDebtCreditCard(accounts);
    assert.equal(result?.id, "cc-1");
  });

  it("ignores zero-balance cards when others have debt", () => {
    const accounts = [
      makeAccount({ id: "cc-1", type: "CREDIT_CARD", currentBalance: "0" }),
      makeAccount({ id: "cc-2", type: "CREDIT_CARD", currentBalance: "-8000" }),
    ];
    const result = getHighestDebtCreditCard(accounts);
    assert.equal(result?.id, "cc-2");
  });

  it("returns undefined for an empty list", () => {
    assert.equal(getHighestDebtCreditCard([]), undefined);
  });

  it("works correctly with a single card", () => {
    const accounts = [makeAccount({ id: "cc-only", type: "CREDIT_CARD", currentBalance: "-1000" })];
    assert.equal(getHighestDebtCreditCard(accounts)?.id, "cc-only");
  });
});

describe("detectCurrencyMismatch", () => {
  it("returns false when both accounts share the same currency", () => {
    const src = makeAccount({ id: "a", currency: "ARS" });
    const dst = makeAccount({ id: "b", currency: "ARS" });
    assert.equal(detectCurrencyMismatch(src, dst), false);
  });

  it("returns true when accounts have different currencies", () => {
    const src = makeAccount({ id: "a", currency: "ARS" });
    const dst = makeAccount({ id: "b", currency: "USD" });
    assert.equal(detectCurrencyMismatch(src, dst), true);
  });

  it("returns true for USD → ARS mismatch", () => {
    const src = makeAccount({ id: "a", currency: "USD" });
    const dst = makeAccount({ id: "b", currency: "ARS" });
    assert.equal(detectCurrencyMismatch(src, dst), true);
  });

  it("returns false when either account is undefined", () => {
    const acc = makeAccount({ id: "a", currency: "ARS" });
    assert.equal(detectCurrencyMismatch(acc, undefined), false);
    assert.equal(detectCurrencyMismatch(undefined, acc), false);
    assert.equal(detectCurrencyMismatch(undefined, undefined), false);
  });
});

describe("sortAccountsByCurrency", () => {
  it("puts ARS accounts first when preferred currency is ARS", () => {
    const accounts = [
      makeAccount({ id: "usd-1", currency: "USD" }),
      makeAccount({ id: "ars-1", currency: "ARS" }),
      makeAccount({ id: "usd-2", currency: "USD" }),
      makeAccount({ id: "ars-2", currency: "ARS" }),
    ];
    const sorted = sortAccountsByCurrency(accounts, "ARS");
    assert.equal(sorted[0].currency, "ARS");
    assert.equal(sorted[1].currency, "ARS");
    assert.equal(sorted[2].currency, "USD");
    assert.equal(sorted[3].currency, "USD");
  });

  it("puts USD accounts first when preferred currency is USD", () => {
    const accounts = [
      makeAccount({ id: "ars-1", currency: "ARS" }),
      makeAccount({ id: "usd-1", currency: "USD" }),
    ];
    const sorted = sortAccountsByCurrency(accounts, "USD");
    assert.equal(sorted[0].id, "usd-1");
    assert.equal(sorted[1].id, "ars-1");
  });

  it("preserves relative order within the same currency group", () => {
    const accounts = [
      makeAccount({ id: "ars-1", currency: "ARS" }),
      makeAccount({ id: "ars-2", currency: "ARS" }),
    ];
    const sorted = sortAccountsByCurrency(accounts, "ARS");
    assert.equal(sorted[0].id, "ars-1");
    assert.equal(sorted[1].id, "ars-2");
  });

  it("returns all accounts unchanged when all share the preferred currency", () => {
    const accounts = [
      makeAccount({ id: "a", currency: "ARS" }),
      makeAccount({ id: "b", currency: "ARS" }),
    ];
    const sorted = sortAccountsByCurrency(accounts, "ARS");
    assert.equal(sorted.length, 2);
  });
});

describe("credit card payment: currency consistency rules", () => {
  it("detects mismatch between ARS source and USD credit card", () => {
    const src = makeAccount({ id: "bank-ars", type: "BANK", currency: "ARS" });
    const cc = makeAccount({ id: "cc-usd", type: "CREDIT_CARD", currency: "USD", currentBalance: "-500" });
    assert.equal(detectCurrencyMismatch(src, cc), true);
  });

  it("no mismatch when source and credit card share currency", () => {
    const src = makeAccount({ id: "bank-ars", type: "BANK", currency: "ARS" });
    const cc = makeAccount({ id: "cc-ars", type: "CREDIT_CARD", currency: "ARS", currentBalance: "-5000" });
    assert.equal(detectCurrencyMismatch(src, cc), false);
  });

  it("highest-debt card is preferred regardless of position in list", () => {
    const ccs = [
      makeAccount({ id: "cc-small", type: "CREDIT_CARD", currentBalance: "-1000" }),
      makeAccount({ id: "cc-large", type: "CREDIT_CARD", currentBalance: "-50000" }),
      makeAccount({ id: "cc-mid",   type: "CREDIT_CARD", currentBalance: "-10000" }),
    ];
    assert.equal(getHighestDebtCreditCard(ccs)?.id, "cc-large");
  });
});
