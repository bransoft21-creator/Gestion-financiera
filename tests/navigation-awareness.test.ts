import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildNavigationAwareness, type NavigationAwarenessInput } from "../lib/navigation-awareness";

const baseInput: NavigationAwarenessInput = {
  canSmartImport: true,
  hasTransactions: true,
  uncategorizedCount: 0,
  frequentGroupCount: 0,
  budgetsAtRiskCount: 0,
  recurringDueCount: 0,
  debtsDueCount: 0,
  openSharedItems: 0,
  pendingHouseholdInvites: 0,
  unreadActivityCount: 0,
};

describe("navigation awareness", () => {
  it("promotes Smart Import softly for users without transactions", () => {
    const awareness = buildNavigationAwareness({
      ...baseInput,
      hasTransactions: false,
    });

    assert.equal(awareness.signals["smart-import"]?.label, "Rápido");
    assert.equal(awareness.entryPoints[0]?.id, "smart-import");
  });

  it("surfaces weekly operating signals without aggressive tones", () => {
    const awareness = buildNavigationAwareness({
      ...baseInput,
      recurringDueCount: 2,
      budgetsAtRiskCount: 1,
      debtsDueCount: 1,
    });

    assert.equal(awareness.signals.recurring?.tone, "attention");
    assert.equal(awareness.signals.budgets?.label, "Atención");
    assert.deepEqual(
      awareness.entryPoints.map((entry) => entry.id),
      ["recurring", "budgets", "debts"],
    );
  });

  it("combines data quality and household counts into discreet signals", () => {
    const awareness = buildNavigationAwareness({
      ...baseInput,
      uncategorizedCount: 4,
      frequentGroupCount: 2,
      openSharedItems: 1,
      pendingHouseholdInvites: 1,
      unreadActivityCount: 3,
    });

    assert.equal(awareness.signals["data-quality"]?.label, "6");
    assert.equal(awareness.signals.household?.label, "2");
    assert.equal(awareness.signals.activity?.label, "3");
    assert.ok(awareness.entryPoints.length <= 4);
  });
});
