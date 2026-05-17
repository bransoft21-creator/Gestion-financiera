import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDashboardEducation,
  getMonthlyCloseEducation,
  getWeeklyPulseEducation,
  pickPrimaryEducation,
  type DashboardEducationMetrics,
  type EducationItem,
} from "../lib/finance/contextual-education";

const baseMetrics: DashboardEducationMetrics = {
  income: 1000,
  expenses: 500,
  upcomingDebtPayments: 0,
  upcomingObligations: 0,
  realAvailable: 180,
  savingsRate: 18,
  totalOutstandingDebt: 0,
  accountBalances: [{ currency: "ARS", amount: 1000 }],
  expensesByType: {
    variable: 250,
  },
  fixedToIncomeRatio: 20,
  projection: {
    confidence: "medium",
  },
};

describe("contextual education", () => {
  it("prioritizes margin education when real available is tight", () => {
    const education = getDashboardEducation({
      ...baseMetrics,
      realAvailable: 20,
      savingsRate: 2,
    });

    assert.equal(education?.category, "financial-margin");
    assert.equal(education?.surface, "dashboard");
  });

  it("uses weekly credit signals to teach credit load without warning language", () => {
    const education = getWeeklyPulseEducation([
      { id: "CREDIT_HEAVY", label: "El gasto semanal fue con tarjeta", severity: "neutral" },
    ]);

    assert.equal(education?.category, "credit-load");
    assert.equal(education?.tone, "neutral");
  });

  it("maps monthly obligations to fixed-cost education", () => {
    const education = getMonthlyCloseEducation([
      { id: "OBLIGATIONS_HIGH", label: "Obligaciones altas", severity: "neutral" },
    ]);

    assert.equal(education?.category, "fixed-costs");
    assert.equal(education?.surface, "monthly-close");
  });

  it("selects the highest-priority item deterministically", () => {
    const lowPriority = {
      id: "a",
      priority: 1,
    } as EducationItem;
    const highPriority = {
      id: "b",
      priority: 2,
    } as EducationItem;

    assert.equal(pickPrimaryEducation([lowPriority, highPriority])?.id, "b");
  });
});
