import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CategoryType, CurrencyCode, TransactionOrigin, TransactionStatus, TransactionType } from "@prisma/client";
import { queryKeys } from "../lib/query-keys";
import { invalidateFinancialData } from "../lib/invalidate";
import {
  buildBudgetSuggestionsFromActivity,
  getBudgetSuggestionWindow,
} from "../server/services/budgets";

const food = { id: "cat-food", name: "Comida", color: "#22c55e" };
const transport = { id: "cat-transport", name: "Transporte", color: "#38bdf8" };
const householdId = "household-main";

function expense(overrides: Partial<Parameters<typeof buildBudgetSuggestionsFromActivity>[0]["transactions"][number]> = {}) {
  return {
    householdId,
    type: TransactionType.EXPENSE,
    status: TransactionStatus.CONFIRMED,
    currency: CurrencyCode.ARS,
    amount: 1000,
    categoryId: food.id,
    occurredAt: new Date("2026-05-10T12:00:00.000Z"),
    origin: TransactionOrigin.MANUAL,
    category: {
      type: CategoryType.EXPENSE,
      deletedAt: null,
      isArchived: false,
    },
    ...overrides,
  };
}

function build(overrides: Partial<Parameters<typeof buildBudgetSuggestionsFromActivity>[0]> = {}) {
  return buildBudgetSuggestionsFromActivity({
    householdId,
    period: { year: 2026, month: 5 },
    householdKind: "PERSONAL",
    primaryCurrency: CurrencyCode.ARS,
    categories: [food, transport],
    existingBudgetCategoryIds: [],
    transactions: [],
    recurringExpenses: [],
    ...overrides,
  });
}

describe("budget suggestions", () => {
  it("includes the target month when suggesting for the current month", () => {
    const window = getBudgetSuggestionWindow(2026, 5, new Date("2026-05-25T15:00:00.000Z"));

    assert.equal(window.start.toISOString(), "2026-03-01T03:00:00.000Z");
    assert.equal(window.end.toISOString(), "2026-06-01T03:00:00.000Z");
    assert.equal(window.includesTargetMonth, true);
  });

  it("returns suggestions for classified EXPENSE movements", () => {
    const result = build({
      transactions: [
        expense({ amount: 12000, occurredAt: new Date("2026-05-01T12:00:00.000Z") }),
        expense({ amount: 18000, occurredAt: new Date("2026-05-08T12:00:00.000Z") }),
      ],
    });

    assert.equal(result.suggestions.length, 1);
    assert.equal(result.suggestions[0].categoryId, food.id);
    assert.equal(result.suggestions[0].suggestedAmount, 30000);
    assert.equal(result.diagnostic, null);
  });

  it("returns a specific diagnostic when movements are uncategorized", () => {
    const result = build({
      transactions: [
        expense({ categoryId: null, category: null }),
        expense({ categoryId: null, category: null, occurredAt: new Date("2026-05-11T12:00:00.000Z") }),
      ],
    });

    assert.equal(result.suggestions.length, 0);
    assert.equal(result.diagnostic?.code, "UNCATEGORIZED_ACTIVITY");
    assert.match(result.diagnostic?.message ?? "", /sin clasificar/);
    assert.equal(result.activitySummary.uncategorizedExpenseCount, 2);
  });

  it("counts confirmed Smart Import movements for suggestions", () => {
    const result = build({
      transactions: [
        expense({
          origin: TransactionOrigin.CARD_SUMMARY,
          status: TransactionStatus.CONFIRMED,
          amount: 7500,
        }),
      ],
    });

    assert.equal(result.suggestions.length, 1);
    assert.equal(result.suggestions[0].transactionCount, 1);
    assert.equal(result.activitySummary.classifiedExpenseCount, 1);
  });

  it("does not count movements from another household", () => {
    const result = build({
      transactions: [
        expense({ householdId: "household-other", amount: 50000 }),
      ],
    });

    assert.equal(result.suggestions.length, 0);
    assert.equal(result.activitySummary.transactionCount, 0);
    assert.equal(result.diagnostic?.code, "NO_ACTIVITY");
  });

  it("returns a currency diagnostic when movements are outside the budget currency", () => {
    const result = build({
      transactions: [
        expense({ currency: CurrencyCode.USD, amount: 100 }),
      ],
    });

    assert.equal(result.suggestions.length, 0);
    assert.equal(result.diagnostic?.code, "OTHER_CURRENCY");
    assert.equal(result.activitySummary.otherCurrencyTransactionCount, 1);
  });

  it("gives medium or high confidence for almost a month of current-month movements", () => {
    const transactions = Array.from({ length: 25 }, (_, index) =>
      expense({
        amount: 1000,
        occurredAt: new Date(`2026-05-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`),
      }),
    );

    const result = build({ transactions });

    assert.equal(result.suggestions.length, 1);
    assert.match(result.suggestions[0].confidence, /medium|high/);
  });

  it("uses the generic empty state only when there are really no movements", () => {
    const result = build();

    assert.equal(result.suggestions.length, 0);
    assert.equal(result.activitySummary.transactionCount, 0);
    assert.equal(result.diagnostic?.code, "NO_ACTIVITY");
    assert.match(result.diagnostic?.message ?? "", /No encontramos movimientos/);
  });

  it("invalidates budget suggestions after Smart Import confirmation", () => {
    const invalidated: unknown[] = [];
    const queryClient = {
      invalidateQueries: ({ queryKey }: { queryKey: unknown[] }) => {
        invalidated.push(queryKey);
      },
    };

    invalidateFinancialData(queryClient as never, "importConfirmed");

    assert.deepEqual(invalidated, [
      queryKeys.transactions.all,
      queryKeys.dashboard.all,
      queryKeys.goals.all,
      queryKeys.debts.all,
      queryKeys.creditCards.all,
      queryKeys.recurring.all,
      queryKeys.budgets.all,
      queryKeys.ccSummary.all,
    ]);
  });
});
