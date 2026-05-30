import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CardStatementStatus } from "@prisma/client";
import { auditCardStatement, highestSeverity } from "../server/services/card-reconciliation-audit";
import {
  assertPlanIsApplicable,
  selectApplicableCardReconciliationActions,
} from "../server/services/card-reconciliation-apply";
import { buildCardReconciliationActions } from "../server/services/card-reconciliation-plan";

describe("card reconciliation audit", () => {
  it("flags a pending statement whose total is not explained by assigned movements", () => {
    const audit = auditCardStatement({
      id: "statement-1",
      status: CardStatementStatus.CLOSED_PENDING_PAYMENT,
      totalAmount: 183_911.6,
      pendingAmount: 183_911.6,
      paidAmount: 0,
      minimumPayment: null,
      dueDate: null,
      movementTotal: 47_480,
      paymentTotal: 0,
    });

    assert.equal(audit.totalVsMovementsDelta, 136_431.6);
    assert.equal(audit.isReconciled, false);
    assert.equal(highestSeverity(audit.issues), "P0");
    assert.ok(audit.issues.some((issue) => issue.code === "STATEMENT_TOTAL_NOT_EXPLAINED"));
    assert.ok(audit.issues.some((issue) => issue.code === "MISSING_DUE_DATE"));
    assert.ok(audit.issues.some((issue) => issue.code === "MISSING_MINIMUM_PAYMENT"));
  });

  it("accepts a closed statement when movements and payments explain pending amount", () => {
    const audit = auditCardStatement({
      id: "statement-2",
      status: CardStatementStatus.PARTIALLY_PAID,
      totalAmount: 120_000,
      pendingAmount: 80_000,
      paidAmount: 40_000,
      minimumPayment: 20_000,
      dueDate: new Date("2026-06-10T03:00:00.000Z"),
      movementTotal: 120_000,
      paymentTotal: 40_000,
    });

    assert.equal(audit.totalVsMovementsDelta, 0);
    assert.equal(audit.pendingDelta, 0);
    assert.equal(audit.isReconciled, true);
    assert.equal(audit.issues.length, 0);
  });
});

describe("card reconciliation plan", () => {
  it("proposes a dry-run migration when archived movements and legacy payment explain the card", () => {
    const actions = buildCardReconciliationActions({
      cardId: "card-1",
      accountId: "account-1",
      name: "Tarjeta",
      currency: "ARS",
      statements: [
        {
          id: "statement-mar",
          periodYear: 2026,
          periodMonth: 3,
          status: CardStatementStatus.ARCHIVED,
          totalAmount: 0,
          pendingAmount: 0,
          minimumPayment: null,
          dueDate: null,
          movementTotal: 24_670,
          movementIds: ["tx-mar"],
        },
        {
          id: "statement-apr",
          periodYear: 2026,
          periodMonth: 4,
          status: CardStatementStatus.ARCHIVED,
          totalAmount: 0,
          pendingAmount: 0,
          minimumPayment: null,
          dueDate: null,
          movementTotal: 111_761.6,
          movementIds: ["tx-apr-1", "tx-apr-2"],
        },
        {
          id: "statement-may",
          periodYear: 2026,
          periodMonth: 5,
          status: CardStatementStatus.CLOSED_PENDING_PAYMENT,
          totalAmount: 183_911.6,
          pendingAmount: 183_911.6,
          minimumPayment: null,
          dueDate: null,
          movementTotal: 47_480,
          movementIds: ["tx-may-1", "tx-may-2"],
        },
      ],
      unassignedExpenses: [
        { id: "legacy-expense-1", amount: 500_000 },
        { id: "legacy-expense-2", amount: 409_755.85 },
      ],
      legacyTransferPayments: [{ id: "legacy-payment-1", amount: 909_755.85 }],
    });

    assert.deepEqual(
      actions.map((action) => action.code),
      [
        "MOVE_ARCHIVED_MOVEMENTS_TO_ACTIVE_STATEMENT",
        "REBUILD_PAID_LEGACY_STATEMENT",
        "CONVERT_LEGACY_TRANSFER_TO_CARD_PAYMENT",
        "COMPLETE_MISSING_STATEMENT_METADATA",
      ],
    );
    assert.equal(actions[0].amount, 136_431.6);
    assert.equal(actions[0].toStatementId, "statement-may");
    assert.equal(actions[1].statementId, "statement-apr");
    assert.equal(actions[2].paymentTransactionIds?.[0], "legacy-payment-1");
    assert.ok(actions.every((action) => action.dryRun));
  });

  it("falls back to manual review when totals do not match", () => {
    const actions = buildCardReconciliationActions({
      cardId: "card-1",
      accountId: "account-1",
      name: "Tarjeta",
      currency: "ARS",
      statements: [
        {
          id: "statement-may",
          periodYear: 2026,
          periodMonth: 5,
          status: CardStatementStatus.CLOSED_PENDING_PAYMENT,
          totalAmount: 100_000,
          pendingAmount: 100_000,
          minimumPayment: 10_000,
          dueDate: new Date("2026-06-10T03:00:00.000Z"),
          movementTotal: 70_000,
          movementIds: ["tx-may"],
        },
      ],
      unassignedExpenses: [{ id: "legacy-expense", amount: 50_000 }],
      legacyTransferPayments: [{ id: "legacy-payment", amount: 40_000 }],
    });

    assert.equal(actions.filter((action) => action.code === "MANUAL_REVIEW_REQUIRED").length, 2);
  });

  it("selects only high-confidence write actions for automatic apply", () => {
    const actions = buildCardReconciliationActions({
      cardId: "card-1",
      accountId: "account-1",
      name: "Tarjeta",
      currency: "ARS",
      statements: [
        {
          id: "statement-mar",
          periodYear: 2026,
          periodMonth: 3,
          status: CardStatementStatus.ARCHIVED,
          totalAmount: 0,
          pendingAmount: 0,
          minimumPayment: null,
          dueDate: null,
          movementTotal: 24_670,
          movementIds: ["tx-mar"],
        },
        {
          id: "statement-may",
          periodYear: 2026,
          periodMonth: 5,
          status: CardStatementStatus.CLOSED_PENDING_PAYMENT,
          totalAmount: 34_670,
          pendingAmount: 34_670,
          minimumPayment: null,
          dueDate: null,
          movementTotal: 10_000,
          movementIds: ["tx-may"],
        },
      ],
      unassignedExpenses: [],
      legacyTransferPayments: [],
    });

    const selection = selectApplicableCardReconciliationActions(actions);

    assert.deepEqual(selection.applicable.map((action) => action.code), [
      "MOVE_ARCHIVED_MOVEMENTS_TO_ACTIVE_STATEMENT",
    ]);
    assert.deepEqual(selection.skipped.map((action) => action.code), [
      "COMPLETE_MISSING_STATEMENT_METADATA",
    ]);
  });

  it("blocks automatic apply when the plan contains manual review actions", () => {
    const actions = buildCardReconciliationActions({
      cardId: "card-1",
      accountId: "account-1",
      name: "Tarjeta",
      currency: "ARS",
      statements: [
        {
          id: "statement-may",
          periodYear: 2026,
          periodMonth: 5,
          status: CardStatementStatus.CLOSED_PENDING_PAYMENT,
          totalAmount: 100_000,
          pendingAmount: 100_000,
          minimumPayment: 10_000,
          dueDate: new Date("2026-06-10T03:00:00.000Z"),
          movementTotal: 70_000,
          movementIds: ["tx-may"],
        },
      ],
      unassignedExpenses: [{ id: "legacy-expense", amount: 50_000 }],
      legacyTransferPayments: [{ id: "legacy-payment", amount: 40_000 }],
    });

    assert.throws(
      () =>
        assertPlanIsApplicable({
          householdId: "household-1",
          checkedAt: new Date("2026-05-30T00:00:00.000Z").toISOString(),
          dryRun: true,
          cardCount: 1,
          actionCount: actions.length,
          cards: [
            {
              cardId: "card-1",
              accountId: "account-1",
              name: "Tarjeta",
              currency: "ARS",
              actions,
            },
          ],
        }),
      /revisión manual/,
    );
  });
});
