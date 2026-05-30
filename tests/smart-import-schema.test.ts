import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { importCandidatesSchema } from "../server/schemas/smart-import";

describe("smart import confirmation schema", () => {
  it("preserves card tax flags and statement summary metadata", () => {
    const parsed = importCandidatesSchema.parse({
      householdId: "household-1",
      statementSummary: {
        statementTotal: 191_670.96,
        totalConsumptions: 183_911.6,
        minimumPayment: 12_000,
        dueDate: "2026-05-14",
        closeDate: "2026-05-07",
        periodYear: 2026,
        periodMonth: 5,
        confidence: 0.94,
      },
      candidates: [
        {
          accountId: "card-account-1",
          categoryId: "tax-category",
          type: "EXPENSE",
          currency: "ARS",
          amount: 1_427.79,
          description: "IVA RG 4240 21% (6799,00)",
          origin: "CARD_SUMMARY",
          paymentMethod: "CREDIT",
          expenseType: "EXTRAORDINARY",
          isInstallment: false,
          isCharge: false,
          isTax: true,
          occurredAt: "2026-05-14",
          status: "CONFIRMED",
        },
      ],
    });

    assert.equal(parsed.candidates[0].isTax, true);
    assert.equal(parsed.candidates[0].isCharge, false);
    assert.equal(parsed.statementSummary?.statementTotal, 191_670.96);
    assert.equal(parsed.statementSummary?.totalConsumptions, 183_911.6);
    assert.equal(parsed.statementSummary?.dueDate?.toISOString(), "2026-05-14T12:00:00.000Z");
  });
});
