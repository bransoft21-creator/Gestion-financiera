import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildNextStepRecommendation, type NextStepContext } from "../server/services/next-step-engine";

const baseContext: NextStepContext = {
  onboardingGoals: [],
  hasAccounts: true,
  hasTransactions: false,
  hasSharedHousehold: false,
  hasBudgets: false,
  hasRecurringExpenses: false,
  hasActiveDebts: false,
  canSmartImport: true,
  onboardingCompletedAt: new Date("2026-05-15T12:00:00.000Z"),
  now: new Date("2026-05-15T12:10:00.000Z"),
};

describe("next step engine", () => {
  it("prioritizes account creation when the workspace has no accounts", () => {
    const recommendation = buildNextStepRecommendation({
      ...baseContext,
      hasAccounts: false,
      onboardingGoals: ["salir-excel"],
    });

    assert.equal(recommendation.shouldShow, true);
    assert.equal(recommendation.actions[0]?.id, "create-account");
    assert.equal(recommendation.actions[1]?.id, "smart-import");
    assert.ok(recommendation.actions.length <= 3);
  });

  it("uses the Excel goal to surface Smart Import after onboarding", () => {
    const recommendation = buildNextStepRecommendation({
      ...baseContext,
      onboardingGoals: ["salir-excel"],
    });

    assert.equal(recommendation.shouldShow, true);
    assert.equal(recommendation.actions[0]?.id, "smart-import");
  });

  it("turns household intent into a household setup action", () => {
    const recommendation = buildNextStepRecommendation({
      ...baseContext,
      onboardingGoals: ["compartir-hogar"],
    });

    assert.equal(recommendation.actions[0]?.id, "setup-household");
  });

  it("falls back to manual movement and budget setup when onboarding was skipped", () => {
    const recommendation = buildNextStepRecommendation(baseContext);

    assert.deepEqual(
      recommendation.actions.map((action) => action.id),
      ["first-income", "smart-import", "setup-budgets"],
    );
  });

  it("stays quiet for established users unless the dashboard is empty", () => {
    const recommendation = buildNextStepRecommendation({
      ...baseContext,
      hasTransactions: true,
      hasBudgets: true,
      hasRecurringExpenses: true,
      onboardingCompletedAt: new Date("2026-04-01T12:00:00.000Z"),
    });

    assert.equal(recommendation.shouldShow, false);
  });
});
