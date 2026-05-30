import {
  AccountType,
  CardPaymentKind,
  CardStatementStatus,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { assertHouseholdAccess } from "./households";
import { toFiniteNumber } from "./financial-ledger";

const TOLERANCE = 0.01;
const ACTIVE_STATEMENT_STATUSES = new Set<CardStatementStatus>([
  CardStatementStatus.OPEN,
  CardStatementStatus.CLOSED_PENDING_PAYMENT,
  CardStatementStatus.PARTIALLY_PAID,
  CardStatementStatus.OVERDUE,
]);

export type ReconciliationPlanActionCode =
  | "MOVE_ARCHIVED_MOVEMENTS_TO_ACTIVE_STATEMENT"
  | "REBUILD_PAID_LEGACY_STATEMENT"
  | "CONVERT_LEGACY_TRANSFER_TO_CARD_PAYMENT"
  | "COMPLETE_MISSING_STATEMENT_METADATA"
  | "MANUAL_REVIEW_REQUIRED";

export type ReconciliationPlanAction = {
  code: ReconciliationPlanActionCode;
  confidence: "high" | "medium" | "low";
  message: string;
  amount?: number;
  count?: number;
  fromStatementIds?: string[];
  toStatementId?: string;
  statementId?: string;
  transactionIds?: string[];
  paymentTransactionIds?: string[];
  dryRun: true;
  writeIntent: string[];
};

export type PlanStatementInput = {
  id: string;
  periodYear: number;
  periodMonth: number;
  status: CardStatementStatus;
  totalAmount: number;
  pendingAmount: number;
  minimumPayment: number | null;
  dueDate: Date | null;
  movementTotal: number;
  movementIds: string[];
};

export type PlanCardInput = {
  cardId: string | null;
  accountId: string;
  name: string;
  currency: string;
  statements: PlanStatementInput[];
  unassignedExpenses: Array<{ id: string; amount: number }>;
  legacyTransferPayments: Array<{ id: string; amount: number }>;
};

export type CardReconciliationPlan = {
  householdId: string;
  checkedAt: string;
  dryRun: true;
  cardCount: number;
  actionCount: number;
  cards: Array<{
    cardId: string | null;
    accountId: string;
    name: string;
    currency: string;
    actions: ReconciliationPlanAction[];
  }>;
};

export function buildCardReconciliationActions(input: PlanCardInput): ReconciliationPlanAction[] {
  const actions: ReconciliationPlanAction[] = [];
  const activeStatement = input.statements
    .filter((statement) => ACTIVE_STATEMENT_STATUSES.has(statement.status) && statement.pendingAmount > TOLERANCE)
    .sort(compareStatementPeriod)[0] ?? null;
  const archivedWithMovements = input.statements.filter(
    (statement) => statement.status === CardStatementStatus.ARCHIVED && statement.movementTotal > TOLERANCE,
  );
  const activeMovementGap = activeStatement
    ? roundMoney(activeStatement.totalAmount - activeStatement.movementTotal)
    : 0;
  const archivedMovementTotal = roundMoney(
    archivedWithMovements.reduce((sum, statement) => sum + statement.movementTotal, 0),
  );

  if (activeStatement && activeMovementGap > TOLERANCE) {
    if (nearlyEqual(activeMovementGap, archivedMovementTotal) && archivedWithMovements.length > 0) {
      actions.push({
        code: "MOVE_ARCHIVED_MOVEMENTS_TO_ACTIVE_STATEMENT",
        confidence: "high",
        message: "Mover movimientos archivados que explican exactamente el faltante del resumen activo.",
        amount: activeMovementGap,
        count: archivedWithMovements.reduce((sum, statement) => sum + statement.movementIds.length, 0),
        fromStatementIds: archivedWithMovements.map((statement) => statement.id),
        toStatementId: activeStatement.id,
        transactionIds: archivedWithMovements.flatMap((statement) => statement.movementIds),
        dryRun: true,
        writeIntent: [
          "Actualizar StatementTransaction.statementId al resumen activo.",
          "Recalcular movementTotal de los statements afectados.",
        ],
      });
    } else {
      actions.push({
        code: "MANUAL_REVIEW_REQUIRED",
        confidence: "low",
        message: "El faltante del resumen activo no coincide con movimientos archivados disponibles.",
        amount: activeMovementGap,
        statementId: activeStatement.id,
        dryRun: true,
        writeIntent: ["No escribir automáticamente; requiere revisión manual."],
      });
    }
  }

  const unassignedExpenseTotal = roundMoney(
    input.unassignedExpenses.reduce((sum, tx) => sum + tx.amount, 0),
  );
  const legacyPaymentTotal = roundMoney(
    input.legacyTransferPayments.reduce((sum, tx) => sum + tx.amount, 0),
  );
  const paidStatementTarget = choosePaidLegacyStatementTarget(input.statements, activeStatement);

  if (unassignedExpenseTotal > TOLERANCE) {
    if (
      input.cardId &&
      paidStatementTarget &&
      input.legacyTransferPayments.length > 0 &&
      nearlyEqual(unassignedExpenseTotal, legacyPaymentTotal)
    ) {
      actions.push({
        code: "REBUILD_PAID_LEGACY_STATEMENT",
        confidence: "high",
        message: "Reconstruir el resumen pagado con los consumos sin asignar.",
        amount: unassignedExpenseTotal,
        count: input.unassignedExpenses.length,
        statementId: paidStatementTarget.id,
        transactionIds: input.unassignedExpenses.map((tx) => tx.id),
        dryRun: true,
        writeIntent: [
          "Actualizar CardStatement.totalAmount, paidAmount, pendingAmount=0 y status=PAID.",
          "Crear StatementTransaction para cada consumo sin asignar apuntando al statement pagado.",
        ],
      });
      actions.push({
        code: "CONVERT_LEGACY_TRANSFER_TO_CARD_PAYMENT",
        confidence: "high",
        message: "Convertir transferencia legacy coincidente en pago formal de tarjeta.",
        amount: legacyPaymentTotal,
        count: input.legacyTransferPayments.length,
        statementId: paidStatementTarget.id,
        paymentTransactionIds: input.legacyTransferPayments.map((tx) => tx.id),
        dryRun: true,
        writeIntent: [
          `Actualizar Transaction.type a ${TransactionType.CARD_PAYMENT}; el efecto contable es equivalente a TRANSFER.`,
          `Crear CardPayment kind=${CardPaymentKind.FULL} contra el statement pagado.`,
        ],
      });
    } else {
      actions.push({
        code: "MANUAL_REVIEW_REQUIRED",
        confidence: "low",
        message: "Hay consumos sin asignar, pero no existe un pago legacy coincidente para reconstruirlos automáticamente.",
        amount: unassignedExpenseTotal,
        count: input.unassignedExpenses.length,
        dryRun: true,
        writeIntent: ["No escribir automáticamente; requiere revisión manual."],
      });
    }
  }

  if (activeStatement && activeStatement.pendingAmount > TOLERANCE && (!activeStatement.dueDate || activeStatement.minimumPayment == null)) {
    actions.push({
      code: "COMPLETE_MISSING_STATEMENT_METADATA",
      confidence: "medium",
      message: "Completar vencimiento y pago mínimo desde el resumen original o Smart Import v2.",
      statementId: activeStatement.id,
      dryRun: true,
      writeIntent: ["Actualizar CardStatement.dueDate y minimumPayment sólo con fuente confiable."],
    });
  }

  return actions;
}

export async function proposeCardReconciliation(
  userProfileId: string,
  householdId: string,
): Promise<CardReconciliationPlan> {
  await assertHouseholdAccess(userProfileId, householdId);

  const accounts = await prisma.account.findMany({
    where: {
      householdId,
      type: AccountType.CREDIT_CARD,
      deletedAt: null,
      isArchived: false,
    },
    select: {
      id: true,
      name: true,
      currency: true,
      creditCard: {
        select: {
          id: true,
          deletedAt: true,
          statements: {
            where: { deletedAt: null },
            select: {
              id: true,
              periodYear: true,
              periodMonth: true,
              status: true,
              totalAmount: true,
              pendingAmount: true,
              minimumPayment: true,
              dueDate: true,
              transactions: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  amount: true,
                },
              },
            },
            orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }],
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const cards = await Promise.all(
    accounts.map(async (account) => {
      const card = account.creditCard?.deletedAt ? null : account.creditCard;
      const [unassignedExpenses, legacyTransferPayments] = await Promise.all([
        prisma.transaction.findMany({
          where: {
            householdId,
            accountId: account.id,
            type: TransactionType.EXPENSE,
            status: { not: TransactionStatus.CANCELED },
            deletedAt: null,
            statementTransactions: { none: { deletedAt: null } },
          },
          select: {
            id: true,
            amount: true,
          },
          orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
        }),
        prisma.transaction.findMany({
          where: {
            householdId,
            transferAccountId: account.id,
            type: TransactionType.TRANSFER,
            status: { not: TransactionStatus.CANCELED },
            deletedAt: null,
          },
          select: {
            id: true,
            amount: true,
            transferAmount: true,
          },
          orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
        }),
      ]);

      const actions = buildCardReconciliationActions({
        cardId: card?.id ?? null,
        accountId: account.id,
        name: account.name,
        currency: account.currency,
        statements: (card?.statements ?? []).map((statement) => ({
          id: statement.id,
          periodYear: statement.periodYear,
          periodMonth: statement.periodMonth,
          status: statement.status,
          totalAmount: toFiniteNumber(statement.totalAmount),
          pendingAmount: toFiniteNumber(statement.pendingAmount),
          minimumPayment:
            statement.minimumPayment != null ? toFiniteNumber(statement.minimumPayment) : null,
          dueDate: statement.dueDate,
          movementTotal: statement.transactions.reduce(
            (sum, tx) => sum + toFiniteNumber(tx.amount),
            0,
          ),
          movementIds: statement.transactions.map((tx) => tx.id),
        })),
        unassignedExpenses: unassignedExpenses.map((tx) => ({
          id: tx.id,
          amount: toFiniteNumber(tx.amount),
        })),
        legacyTransferPayments: legacyTransferPayments.map((tx) => ({
          id: tx.id,
          amount: toFiniteNumber(tx.transferAmount ?? tx.amount),
        })),
      });

      return {
        cardId: card?.id ?? null,
        accountId: account.id,
        name: account.name,
        currency: account.currency,
        actions,
      };
    }),
  );

  return {
    householdId,
    checkedAt: new Date().toISOString(),
    dryRun: true,
    cardCount: cards.length,
    actionCount: cards.reduce((sum, card) => sum + card.actions.length, 0),
    cards,
  };
}

function choosePaidLegacyStatementTarget(
  statements: PlanStatementInput[],
  activeStatement: PlanStatementInput | null,
) {
  const candidates = statements
    .filter((statement) => statement.status === CardStatementStatus.ARCHIVED)
    .filter((statement) => !activeStatement || compareStatementPeriod(statement, activeStatement) < 0)
    .sort((a, b) => compareStatementPeriod(b, a));

  return candidates[0] ?? null;
}

function compareStatementPeriod(a: Pick<PlanStatementInput, "periodYear" | "periodMonth">, b: Pick<PlanStatementInput, "periodYear" | "periodMonth">) {
  return a.periodYear === b.periodYear
    ? a.periodMonth - b.periodMonth
    : a.periodYear - b.periodYear;
}

function nearlyEqual(a: number, b: number) {
  return Math.abs(roundMoney(a) - roundMoney(b)) <= TOLERANCE;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
