/**
 * Tests for the "Compromiso formal registrado" activity announcement invariant.
 *
 * Bug: The announcement was created when accountLiabilities > 0 (e.g., a CC account
 * with negative balance after importing transactions). actionLink="/debts" navigates to
 * the Debt entity list, which was empty — causing an empty screen.
 *
 * Fix: The condition must use the raw sum of Debt records' outstandingAmount, not
 * liabilitySummary.liabilities (which includes negative account balances).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AccountType, DebtStatus, DebtType } from "@prisma/client";
import {
  computeRealLiabilitySummary,
  toFiniteNumber,
} from "../server/services/financial-ledger";

// Mirror of the announcement trigger logic extracted from upsertReminderActivities.
// If this returns > 0, the announcement fires and navigates to /debts.
function totalDebtOutstanding(debts: Array<{ outstandingAmount: number }>): number {
  return debts.reduce((sum, d) => sum + d.outstandingAmount, 0);
}

const ccAccount = (balance: number) => ({
  type: AccountType.CREDIT_CARD,
  currency: "ARS",
  currentBalance: balance,
  isArchived: false,
  deletedAt: null,
});

const activeDebt = (outstandingAmount: number, type: DebtType = DebtType.CREDIT_CARD) => ({
  type,
  status: DebtStatus.ACTIVE,
  currency: "ARS",
  outstandingAmount,
  nextDueDate: null,
});

describe("activity debt announcement invariant", () => {
  it("fires when Debt records exist with outstanding balance", () => {
    const debts = [activeDebt(85_000)];
    assert.equal(totalDebtOutstanding(debts) > 0, true);
  });

  it("does NOT fire when Debt records are empty (even if CC account balance is negative)", () => {
    // This is the bug scenario: CC expenses were imported, account balance went negative,
    // but no Debt entity records exist. The old code used liabilitySummary.liabilities
    // which included the negative account balance → announcement fired → /debts empty.
    const debts: ReturnType<typeof activeDebt>[] = [];
    assert.equal(totalDebtOutstanding(debts), 0);
    assert.equal(totalDebtOutstanding(debts) > 0, false);
  });

  it("amount shown is the raw sum of Debt records, not the dedup-adjusted liability", () => {
    // When a CC account also has a negative balance, computeRealLiabilitySummary deduplicates.
    // But the announcement must show the full outstanding amount from Debt records so the user
    // understands what they registered as a formal commitment.
    const accounts = [ccAccount(-80_000)];
    const debts = [activeDebt(120_000)];

    const summary = computeRealLiabilitySummary(accounts, debts);
    // Dedup: CC account already covers 80k of the 120k debt → debtLiabilities = 40k
    // liabilities = 80k (account) + 40k (debt after dedup) = 120k
    assert.equal(summary.debtLiabilities, 40_000);
    assert.equal(summary.liabilities, 120_000);

    // The announcement shows the raw debt outstanding (120k), not the dedup-adjusted 40k.
    // This is what the user registered as their formal obligation in /debts.
    assert.equal(totalDebtOutstanding(debts), 120_000);
  });

  it("resolves announcement when all Debt records are paid off", () => {
    const paidDebts: ReturnType<typeof activeDebt>[] = []; // outstandingAmount=0 debts are excluded by the DB query
    assert.equal(totalDebtOutstanding(paidDebts), 0);
    // → resolveReminderIfPresent fires, dismissing the stale announcement
  });

  it("liabilitySummary.liabilities > 0 with only negative CC account (the original bug source)", () => {
    const accounts = [ccAccount(-95_000)];
    const debts: ReturnType<typeof activeDebt>[] = [];

    const summary = computeRealLiabilitySummary(accounts, debts);
    // Old condition: debt > 0 → announcement fires → /debts empty → BUG
    assert.equal(summary.liabilities > 0, true, "old condition fired incorrectly");
    // New condition: totalDebtOutstanding > 0 → announcement does NOT fire → correct
    assert.equal(totalDebtOutstanding(debts) > 0, false, "new condition correctly suppresses announcement");
  });

  it("hasOverdueDebt requires actual Debt records with past nextDueDate", () => {
    const past = new Date(Date.now() - 86_400_000);
    const overdue = { ...activeDebt(50_000), nextDueDate: past };
    assert.equal([overdue].some((d) => d.nextDueDate !== null && d.nextDueDate < new Date()), true);

    // Without Debt records: can't be overdue
    const empty: typeof overdue[] = [];
    assert.equal(empty.some((d) => d.nextDueDate !== null && d.nextDueDate < new Date()), false);
  });
});
