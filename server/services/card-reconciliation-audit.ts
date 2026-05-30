import {
  AccountType,
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

export type CardAuditSeverity = "P0" | "P1" | "P2";
export type CardAuditCode =
  | "ACCOUNT_PENDING_MISMATCH"
  | "STATEMENT_TOTAL_NOT_EXPLAINED"
  | "STATEMENT_PENDING_NOT_EXPLAINED"
  | "MISSING_DUE_DATE"
  | "MISSING_MINIMUM_PAYMENT"
  | "LEGACY_TRANSFER_PAYMENT"
  | "UNASSIGNED_CARD_EXPENSES"
  | "ARCHIVED_STATEMENT_WITH_MOVEMENTS"
  | "NO_CREDIT_CARD_MODEL";

export type CardAuditIssue = {
  severity: CardAuditSeverity;
  code: CardAuditCode;
  message: string;
  amount?: number;
  count?: number;
  statementId?: string;
};

export type CardStatementAuditInput = {
  id: string;
  status: CardStatementStatus;
  totalAmount: number;
  pendingAmount: number;
  paidAmount: number;
  minimumPayment: number | null;
  dueDate: Date | null;
  movementTotal: number;
  paymentTotal: number;
};

export type CardStatementAudit = {
  id: string;
  status: CardStatementStatus;
  totalAmount: number;
  pendingAmount: number;
  paidAmount: number;
  minimumPayment: number | null;
  dueDate: string | null;
  movementTotal: number;
  paymentTotal: number;
  totalVsMovementsDelta: number;
  expectedPendingFromPayments: number;
  pendingDelta: number;
  isReconciled: boolean;
  issues: CardAuditIssue[];
};

export type CardReconciliationReport = {
  householdId: string;
  checkedAt: string;
  cardCount: number;
  issueCount: number;
  highestSeverity: CardAuditSeverity | null;
  cards: Array<{
    cardId: string | null;
    accountId: string;
    name: string;
    currency: string;
    accountBalance: number;
    accountLiability: number;
    activeStatementPending: number;
    accountVsStatementsDelta: number;
    statementCount: number;
    unassignedExpenseCount: number;
    unassignedExpenseTotal: number;
    legacyTransferPaymentCount: number;
    legacyTransferPaymentTotal: number;
    statements: CardStatementAudit[];
    samples: {
      unassignedExpenses: Array<{
        id: string;
        description: string | null;
        amount: number;
        occurredAt: string;
      }>;
      legacyTransferPayments: Array<{
        id: string;
        description: string | null;
        amount: number;
        occurredAt: string;
      }>;
    };
    issues: CardAuditIssue[];
  }>;
};

export function auditCardStatement(input: CardStatementAuditInput): CardStatementAudit {
  const totalVsMovementsDelta = roundMoney(input.totalAmount - input.movementTotal);
  const expectedPendingFromPayments = roundMoney(Math.max(input.totalAmount - input.paymentTotal, 0));
  const pendingDelta = roundMoney(input.pendingAmount - expectedPendingFromPayments);
  const issues: CardAuditIssue[] = [];

  if (Math.abs(totalVsMovementsDelta) > TOLERANCE && input.status !== CardStatementStatus.ARCHIVED) {
    issues.push({
      severity: "P0",
      code: "STATEMENT_TOTAL_NOT_EXPLAINED",
      statementId: input.id,
      amount: totalVsMovementsDelta,
      message: "El total del resumen no se explica con sus movimientos asignados.",
    });
  }

  if (Math.abs(pendingDelta) > TOLERANCE && input.status !== CardStatementStatus.ARCHIVED) {
    issues.push({
      severity: "P0",
      code: "STATEMENT_PENDING_NOT_EXPLAINED",
      statementId: input.id,
      amount: pendingDelta,
      message: "El saldo pendiente del resumen no coincide con total menos pagos aplicados.",
    });
  }

  if (input.pendingAmount > TOLERANCE && !input.dueDate) {
    issues.push({
      severity: "P1",
      code: "MISSING_DUE_DATE",
      statementId: input.id,
      message: "El resumen tiene saldo pendiente pero no tiene vencimiento.",
    });
  }

  if (input.pendingAmount > TOLERANCE && input.minimumPayment == null) {
    issues.push({
      severity: "P1",
      code: "MISSING_MINIMUM_PAYMENT",
      statementId: input.id,
      message: "El resumen tiene saldo pendiente pero no tiene pago mínimo.",
    });
  }

  if (input.status === CardStatementStatus.ARCHIVED && input.movementTotal > TOLERANCE) {
    issues.push({
      severity: "P2",
      code: "ARCHIVED_STATEMENT_WITH_MOVEMENTS",
      statementId: input.id,
      amount: input.movementTotal,
      message: "El resumen archivado conserva movimientos; confirmar que no explican deuda viva.",
    });
  }

  return {
    ...input,
    dueDate: input.dueDate?.toISOString() ?? null,
    totalVsMovementsDelta,
    expectedPendingFromPayments,
    pendingDelta,
    isReconciled: issues.filter((issue) => issue.severity === "P0").length === 0,
    issues,
  };
}

export function highestSeverity(issues: CardAuditIssue[]): CardAuditSeverity | null {
  if (issues.some((issue) => issue.severity === "P0")) return "P0";
  if (issues.some((issue) => issue.severity === "P1")) return "P1";
  if (issues.some((issue) => issue.severity === "P2")) return "P2";
  return null;
}

export async function auditCardReconciliation(
  userProfileId: string,
  householdId: string,
): Promise<CardReconciliationReport> {
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
      currentBalance: true,
      creditCard: {
        select: {
          id: true,
          deletedAt: true,
          statements: {
            where: { deletedAt: null },
            select: {
              id: true,
              status: true,
              totalAmount: true,
              pendingAmount: true,
              paidAmount: true,
              minimumPayment: true,
              dueDate: true,
              transactions: {
                where: { deletedAt: null },
                select: { amount: true },
              },
              payments: {
                where: { deletedAt: null },
                select: { amount: true },
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
      const statements = (card?.statements ?? []).map((statement) =>
        auditCardStatement({
          id: statement.id,
          status: statement.status,
          totalAmount: toFiniteNumber(statement.totalAmount),
          pendingAmount: toFiniteNumber(statement.pendingAmount),
          paidAmount: toFiniteNumber(statement.paidAmount),
          minimumPayment:
            statement.minimumPayment != null ? toFiniteNumber(statement.minimumPayment) : null,
          dueDate: statement.dueDate,
          movementTotal: statement.transactions.reduce(
            (sum, movement) => sum + toFiniteNumber(movement.amount),
            0,
          ),
          paymentTotal: statement.payments.reduce(
            (sum, payment) => sum + toFiniteNumber(payment.amount),
            0,
          ),
        }),
      );

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
            description: true,
            amount: true,
            occurredAt: true,
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
            description: true,
            amount: true,
            transferAmount: true,
            occurredAt: true,
          },
          orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
        }),
      ]);

      const accountBalance = toFiniteNumber(account.currentBalance);
      const accountLiability = Math.max(-accountBalance, 0);
      const activeStatementPending = statements
        .filter((statement) => ACTIVE_STATEMENT_STATUSES.has(statement.status))
        .reduce((sum, statement) => sum + statement.pendingAmount, 0);
      const accountVsStatementsDelta = roundMoney(accountLiability - activeStatementPending);
      const unassignedExpenseTotal = roundMoney(
        unassignedExpenses.reduce((sum, tx) => sum + toFiniteNumber(tx.amount), 0),
      );
      const legacyTransferPaymentTotal = roundMoney(
        legacyTransferPayments.reduce(
          (sum, tx) => sum + toFiniteNumber(tx.transferAmount ?? tx.amount),
          0,
        ),
      );
      const issues = statements.flatMap((statement) => statement.issues);

      if (!card) {
        issues.push({
          severity: "P0",
          code: "NO_CREDIT_CARD_MODEL",
          message: "La cuenta de tarjeta no tiene modelo CreditCard vinculado.",
        });
      }

      if (Math.abs(accountVsStatementsDelta) > TOLERANCE) {
        issues.push({
          severity: "P0",
          code: "ACCOUNT_PENDING_MISMATCH",
          amount: accountVsStatementsDelta,
          message: "El saldo de la cuenta de tarjeta no coincide con los resúmenes activos.",
        });
      }

      if (unassignedExpenses.length > 0) {
        issues.push({
          severity: "P0",
          code: "UNASSIGNED_CARD_EXPENSES",
          count: unassignedExpenses.length,
          amount: unassignedExpenseTotal,
          message: "Hay consumos de tarjeta sin asignar a ningún resumen.",
        });
      }

      if (legacyTransferPayments.length > 0) {
        issues.push({
          severity: "P1",
          code: "LEGACY_TRANSFER_PAYMENT",
          count: legacyTransferPayments.length,
          amount: legacyTransferPaymentTotal,
          message: "Hay pagos de tarjeta registrados como transferencia legacy, no como CardPayment.",
        });
      }

      return {
        cardId: card?.id ?? null,
        accountId: account.id,
        name: account.name,
        currency: account.currency,
        accountBalance,
        accountLiability,
        activeStatementPending,
        accountVsStatementsDelta,
        statementCount: statements.length,
        unassignedExpenseCount: unassignedExpenses.length,
        unassignedExpenseTotal,
        legacyTransferPaymentCount: legacyTransferPayments.length,
        legacyTransferPaymentTotal,
        statements,
        samples: {
          unassignedExpenses: unassignedExpenses.slice(0, 20).map((tx) => ({
            id: tx.id,
            description: tx.description,
            amount: toFiniteNumber(tx.amount),
            occurredAt: tx.occurredAt.toISOString(),
          })),
          legacyTransferPayments: legacyTransferPayments.slice(0, 20).map((tx) => ({
            id: tx.id,
            description: tx.description,
            amount: toFiniteNumber(tx.transferAmount ?? tx.amount),
            occurredAt: tx.occurredAt.toISOString(),
          })),
        },
        issues,
      };
    }),
  );

  const issues = cards.flatMap((card) => card.issues);

  return {
    householdId,
    checkedAt: new Date().toISOString(),
    cardCount: cards.length,
    issueCount: issues.length,
    highestSeverity: highestSeverity(issues),
    cards,
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
