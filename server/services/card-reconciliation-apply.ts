import {
  CardPaymentKind,
  CardStatementStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../api/errors";
import { auditCardReconciliation } from "./card-reconciliation-audit";
import { toFiniteNumber } from "./financial-ledger";
import {
  CardReconciliationPlan,
  ReconciliationPlanAction,
  ReconciliationPlanActionCode,
  proposeCardReconciliation,
} from "./card-reconciliation-plan";

const TOLERANCE = 0.01;

const APPLYABLE_ACTION_CODES = new Set<ReconciliationPlanActionCode>([
  "MOVE_ARCHIVED_MOVEMENTS_TO_ACTIVE_STATEMENT",
  "REBUILD_PAID_LEGACY_STATEMENT",
  "CONVERT_LEGACY_TRANSFER_TO_CARD_PAYMENT",
]);

export const CARD_RECONCILIATION_APPLY_CONFIRMATION = "APPLY_CARD_RECONCILIATION";

export type CardReconciliationApplyInput = {
  householdId: string;
  confirm: typeof CARD_RECONCILIATION_APPLY_CONFIRMATION;
};

export type CardReconciliationActionSelection = {
  applicable: ReconciliationPlanAction[];
  skipped: ReconciliationPlanAction[];
};

export type AppliedCardReconciliationAction = {
  code: ReconciliationPlanActionCode;
  message: string;
  count: number;
  amount?: number;
  statementId?: string;
  toStatementId?: string;
};

export function selectApplicableCardReconciliationActions(
  actions: ReconciliationPlanAction[],
): CardReconciliationActionSelection {
  return actions.reduce<CardReconciliationActionSelection>(
    (selection, action) => {
      if (APPLYABLE_ACTION_CODES.has(action.code) && action.confidence === "high") {
        selection.applicable.push(action);
      } else {
        selection.skipped.push(action);
      }

      return selection;
    },
    { applicable: [], skipped: [] },
  );
}

export function assertPlanIsApplicable(plan: CardReconciliationPlan) {
  const manualActions = plan.cards.flatMap((card) =>
    card.actions.filter((action) => action.code === "MANUAL_REVIEW_REQUIRED"),
  );

  if (manualActions.length > 0) {
    throw new ApiError(
      409,
      "El plan contiene acciones de revisión manual. No se puede aplicar automáticamente.",
    );
  }

  const lowConfidenceWriteActions = plan.cards.flatMap((card) =>
    card.actions.filter((action) =>
      APPLYABLE_ACTION_CODES.has(action.code) && action.confidence !== "high",
    ),
  );

  if (lowConfidenceWriteActions.length > 0) {
    throw new ApiError(
      409,
      "El plan contiene escrituras sin confianza alta. No se puede aplicar automáticamente.",
    );
  }
}

export async function applyCardReconciliation(
  userProfileId: string,
  input: CardReconciliationApplyInput,
) {
  if (input.confirm !== CARD_RECONCILIATION_APPLY_CONFIRMATION) {
    throw new ApiError(400, "Confirmación inválida para aplicar la conciliación.");
  }

  const beforePlan = await proposeCardReconciliation(userProfileId, input.householdId);
  assertPlanIsApplicable(beforePlan);

  const appliedAt = new Date();
  const appliedActions: AppliedCardReconciliationAction[] = [];
  const skippedActions: ReconciliationPlanAction[] = [];

  await prisma.$transaction(async (tx) => {
    for (const card of beforePlan.cards) {
      const selection = selectApplicableCardReconciliationActions(card.actions);
      skippedActions.push(...selection.skipped);

      for (const action of selection.applicable) {
        if (action.code === "MOVE_ARCHIVED_MOVEMENTS_TO_ACTIVE_STATEMENT") {
          appliedActions.push(
            await applyMoveArchivedMovements(tx, input.householdId, card, action),
          );
        }

        if (action.code === "REBUILD_PAID_LEGACY_STATEMENT") {
          appliedActions.push(
            await applyRebuildPaidLegacyStatement(tx, input.householdId, card, action),
          );
        }

        if (action.code === "CONVERT_LEGACY_TRANSFER_TO_CARD_PAYMENT") {
          appliedActions.push(
            await applyConvertLegacyTransferPayment(tx, input.householdId, card, action),
          );
        }
      }
    }
  });

  const afterAudit = await auditCardReconciliation(userProfileId, input.householdId);

  return {
    dryRun: false,
    householdId: input.householdId,
    appliedAt: appliedAt.toISOString(),
    appliedActionCount: appliedActions.length,
    skippedActionCount: skippedActions.length,
    appliedActions,
    skippedActions,
    beforePlan,
    afterAudit,
  };
}

async function applyMoveArchivedMovements(
  tx: Prisma.TransactionClient,
  householdId: string,
  card: CardReconciliationPlan["cards"][number],
  action: ReconciliationPlanAction,
): Promise<AppliedCardReconciliationAction> {
  const statementTransactionIds = action.transactionIds ?? [];
  const fromStatementIds = action.fromStatementIds ?? [];

  if (!card.cardId || !action.toStatementId || statementTransactionIds.length === 0 || fromStatementIds.length === 0) {
    throw new ApiError(409, "El movimiento de resúmenes archivados está incompleto.");
  }

  const targetStatement = await tx.cardStatement.findFirst({
    where: {
      id: action.toStatementId,
      householdId,
      creditCardId: card.cardId,
      deletedAt: null,
      status: {
        in: [
          CardStatementStatus.OPEN,
          CardStatementStatus.CLOSED_PENDING_PAYMENT,
          CardStatementStatus.PARTIALLY_PAID,
          CardStatementStatus.OVERDUE,
        ],
      },
    },
    select: { id: true },
  });

  if (!targetStatement) {
    throw new ApiError(409, "El resumen activo destino ya no está disponible.");
  }

  const movements = await tx.statementTransaction.findMany({
    where: {
      id: { in: statementTransactionIds },
      householdId,
      creditCardId: card.cardId,
      statementId: { in: fromStatementIds },
      deletedAt: null,
      statement: {
        status: CardStatementStatus.ARCHIVED,
        deletedAt: null,
      },
    },
    select: { id: true, amount: true },
  });

  if (movements.length !== statementTransactionIds.length) {
    throw new ApiError(409, "Algunos movimientos archivados ya no coinciden con el plan.");
  }

  const movementTotal = roundMoney(
    movements.reduce((sum, movement) => sum + toFiniteNumber(movement.amount), 0),
  );

  if (action.amount != null && !nearlyEqual(movementTotal, action.amount)) {
    throw new ApiError(409, "El total de movimientos archivados cambió desde el dry-run.");
  }

  const updated = await tx.statementTransaction.updateMany({
    where: {
      id: { in: statementTransactionIds },
      householdId,
      creditCardId: card.cardId,
      statementId: { in: fromStatementIds },
      deletedAt: null,
    },
    data: { statementId: action.toStatementId },
  });

  if (updated.count !== statementTransactionIds.length) {
    throw new ApiError(409, "No se pudieron mover todos los movimientos archivados.");
  }

  return {
    code: action.code,
    message: action.message,
    count: updated.count,
    amount: movementTotal,
    toStatementId: action.toStatementId,
  };
}

async function applyRebuildPaidLegacyStatement(
  tx: Prisma.TransactionClient,
  householdId: string,
  card: CardReconciliationPlan["cards"][number],
  action: ReconciliationPlanAction,
): Promise<AppliedCardReconciliationAction> {
  const transactionIds = action.transactionIds ?? [];

  if (!card.cardId || !action.statementId || transactionIds.length === 0) {
    throw new ApiError(409, "La reconstrucción del resumen pagado está incompleta.");
  }

  const statement = await tx.cardStatement.findFirst({
    where: {
      id: action.statementId,
      householdId,
      creditCardId: card.cardId,
      deletedAt: null,
    },
    select: {
      id: true,
      currency: true,
    },
  });

  if (!statement) {
    throw new ApiError(409, "El resumen pagado destino ya no está disponible.");
  }

  const transactions = await tx.transaction.findMany({
    where: {
      id: { in: transactionIds },
      householdId,
      accountId: card.accountId,
      type: TransactionType.EXPENSE,
      status: { not: TransactionStatus.CANCELED },
      deletedAt: null,
      statementTransactions: { none: { deletedAt: null } },
    },
    select: {
      id: true,
      categoryId: true,
      description: true,
      currency: true,
      amount: true,
      occurredAt: true,
      isInstallment: true,
      installmentNumber: true,
      totalInstallments: true,
    },
  });

  if (transactions.length !== transactionIds.length) {
    throw new ApiError(409, "Algunos consumos sin asignar ya no coinciden con el plan.");
  }

  const total = roundMoney(
    transactions.reduce((sum, transaction) => sum + toFiniteNumber(transaction.amount), 0),
  );

  if (action.amount != null && !nearlyEqual(total, action.amount)) {
    throw new ApiError(409, "El total de consumos sin asignar cambió desde el dry-run.");
  }

  if (transactions.some((transaction) => transaction.currency !== statement.currency)) {
    throw new ApiError(409, "Hay consumos con moneda distinta al resumen destino.");
  }

  await tx.cardStatement.update({
    where: { id: statement.id },
    data: {
      status: CardStatementStatus.PAID,
      totalAmount: total,
      pendingAmount: 0,
      paidAmount: total,
    },
  });

  await tx.statementTransaction.createMany({
    data: transactions.map((transaction) => ({
      householdId,
      creditCardId: card.cardId!,
      statementId: statement.id,
      transactionId: transaction.id,
      categoryId: transaction.categoryId,
      description: transaction.description,
      currency: transaction.currency,
      amount: transaction.amount,
      occurredAt: transaction.occurredAt,
      installmentGroupId: transaction.isInstallment ? transaction.id : null,
      installmentNumber: transaction.installmentNumber,
      totalInstallments: transaction.totalInstallments,
    })),
    skipDuplicates: true,
  });

  const created = await tx.statementTransaction.count({
    where: {
      householdId,
      creditCardId: card.cardId,
      statementId: statement.id,
      transactionId: { in: transactionIds },
      deletedAt: null,
    },
  });

  if (created !== transactionIds.length) {
    throw new ApiError(409, "No se pudieron vincular todos los consumos al resumen pagado.");
  }

  return {
    code: action.code,
    message: action.message,
    count: created,
    amount: total,
    statementId: statement.id,
  };
}

async function applyConvertLegacyTransferPayment(
  tx: Prisma.TransactionClient,
  householdId: string,
  card: CardReconciliationPlan["cards"][number],
  action: ReconciliationPlanAction,
): Promise<AppliedCardReconciliationAction> {
  const paymentTransactionIds = action.paymentTransactionIds ?? [];

  if (!card.cardId || !action.statementId || paymentTransactionIds.length === 0) {
    throw new ApiError(409, "La conversión de pago legacy está incompleta.");
  }

  const statement = await tx.cardStatement.findFirst({
    where: {
      id: action.statementId,
      householdId,
      creditCardId: card.cardId,
      deletedAt: null,
    },
    select: {
      id: true,
      currency: true,
      totalAmount: true,
    },
  });

  if (!statement) {
    throw new ApiError(409, "El resumen destino del pago ya no está disponible.");
  }

  const transactions = await tx.transaction.findMany({
    where: {
      id: { in: paymentTransactionIds },
      householdId,
      transferAccountId: card.accountId,
      type: TransactionType.TRANSFER,
      status: { not: TransactionStatus.CANCELED },
      deletedAt: null,
      cardPayments: { none: { deletedAt: null } },
    },
    select: {
      id: true,
      accountId: true,
      currency: true,
      amount: true,
      transferAmount: true,
      occurredAt: true,
    },
  });

  if (transactions.length !== paymentTransactionIds.length) {
    throw new ApiError(409, "Algunas transferencias legacy ya no coinciden con el plan.");
  }

  const total = roundMoney(
    transactions.reduce((sum, transaction) => {
      return sum + toFiniteNumber(transaction.transferAmount ?? transaction.amount);
    }, 0),
  );

  if (action.amount != null && !nearlyEqual(total, action.amount)) {
    throw new ApiError(409, "El total de pagos legacy cambió desde el dry-run.");
  }

  if (transactions.some((transaction) => transaction.currency !== statement.currency)) {
    throw new ApiError(409, "Hay pagos con moneda distinta al resumen destino.");
  }

  for (const transaction of transactions) {
    const paymentAmount = toFiniteNumber(transaction.transferAmount ?? transaction.amount);

    await tx.transaction.update({
      where: { id: transaction.id },
      data: { type: TransactionType.CARD_PAYMENT },
    });

    await tx.cardPayment.create({
      data: {
        householdId,
        creditCardId: card.cardId,
        statementId: statement.id,
        sourceAccountId: transaction.accountId,
        transactionId: transaction.id,
        kind: CardPaymentKind.FULL,
        currency: transaction.currency,
        amount: paymentAmount,
        paidAt: transaction.occurredAt,
      },
    });
  }

  return {
    code: action.code,
    message: action.message,
    count: transactions.length,
    amount: total,
    statementId: statement.id,
  };
}

function nearlyEqual(a: number, b: number) {
  return Math.abs(roundMoney(a) - roundMoney(b)) <= TOLERANCE;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
