import {
  AccountType,
  CardPaymentKind,
  CardStatementStatus,
  CurrencyCode,
  DebtStatus,
  DebtType,
  Prisma,
  TransactionOrigin,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { argentinaMonthParts, argentinaMonthRangeUtc, formatArgentinaDateInput } from "@/lib/dates";
import { prisma } from "../../lib/prisma";
import { ApiError, FieldApiError, NotFoundError } from "../api/errors";
import type { ListCreditCardsInput, PayCardStatementInput } from "../schemas/credit-cards";
import { assertHouseholdAccess } from "./households";
import {
  applyBalanceDeltas,
  computeTransactionBalanceDeltas,
  toFiniteNumber,
} from "./financial-ledger";

type CardStatementInput = {
  status: CardStatementStatus;
  totalAmount: Prisma.Decimal | number;
  pendingAmount: Prisma.Decimal | number;
  paidAmount: Prisma.Decimal | number;
  minimumPayment: Prisma.Decimal | number | null;
  dueDate: Date | null;
};

type ImportedCardTransaction = {
  id: string;
  categoryId: string | null;
  description: string | null;
  currency: CurrencyCode;
  amount: Prisma.Decimal;
  occurredAt: Date;
  isInstallment: boolean;
  installmentNumber: number | null;
  totalInstallments: number | null;
  isTax?: boolean;
};

export type CardPressure = "none" | "low" | "medium" | "high" | "overdue";

export async function listCreditCards(userProfileId: string, input: ListCreditCardsInput) {
  await assertHouseholdAccess(userProfileId, input.householdId);
  await syncLegacyCreditCards(userProfileId, input.householdId);

  const cards = await prisma.creditCard.findMany({
    where: {
      householdId: input.householdId,
      deletedAt: null,
    },
    include: {
      account: {
        select: {
          id: true,
          name: true,
          currentBalance: true,
          creditLimit: true,
          currency: true,
        },
      },
      statements: {
        where: { deletedAt: null },
        include: {
          transactions: {
            where: { deletedAt: null },
            include: {
              transaction: {
                select: {
                  id: true,
                  description: true,
                  category: {
                    select: {
                      name: true,
                      icon: true,
                    },
                  },
                },
              },
            },
            orderBy: { occurredAt: "desc" },
            take: 100,
          },
          _count: {
            select: {
              transactions: true,
              payments: true,
            },
          },
        },
        orderBy: [{ dueDate: "asc" }, { cycleEndDate: "desc" }],
      },
    },
    orderBy: { name: "asc" },
  });
  const statementIds = cards.flatMap((card) => card.statements.map((statement) => statement.id));
  const statementMovementTotals = new Map(
    statementIds.length > 0
      ? (await prisma.statementTransaction.groupBy({
          by: ["statementId"],
          where: {
            statementId: { in: statementIds },
            deletedAt: null,
          },
          _sum: { amount: true },
        })).map((row) => [row.statementId, toFiniteNumber(row._sum.amount ?? 0)])
      : [],
  );

  return {
    cards: cards.map((card) => {
      const statements = card.statements.map((statement) => serializeStatement({
        ...statement,
        movementTotal: statementMovementTotals.get(statement.id) ?? 0,
      }));
      const pendingStatements = statements
        .filter((statement) =>
          ["OVERDUE", "CLOSED_PENDING_PAYMENT", "PARTIALLY_PAID"].includes(statement.status),
        )
        .sort(compareStatementUrgency);
      const currentStatement =
        statements.find((statement) => statement.status === "OPEN") ?? null;
      const history = statements
        .filter((statement) => ["PAID", "ARCHIVED"].includes(statement.status))
        .sort((a, b) => Date.parse(b.cycleEndDate) - Date.parse(a.cycleEndDate));
      const activeStatement = pendingStatements[0] ?? currentStatement;
      const creditLimit =
        card.creditLimit != null
          ? toFiniteNumber(card.creditLimit)
          : card.account?.creditLimit != null
            ? toFiniteNumber(card.account.creditLimit)
            : null;
      const usedAmount = Math.max(toFiniteNumber(card.account?.currentBalance ?? 0) * -1, 0);
      const utilizationPercent =
        creditLimit && creditLimit > 0 ? Math.min(Math.round((usedAmount / creditLimit) * 100), 999) : null;

      return {
        id: card.id,
        householdId: card.householdId,
        accountId: card.accountId,
        name: card.name,
        issuer: card.issuer,
        network: card.network,
        last4: card.last4,
        closeDay: card.closeDay,
        dueDay: card.dueDay,
        currency: card.currency,
        creditLimit,
        usedAmount,
        utilizationPercent,
        isActive: card.isActive,
        pressure: getCardPressure(activeStatement),
        activeStatement,
        pendingStatements,
        currentStatement,
        history,
        statements,
      };
    }),
  };
}

export async function payCardStatement(
  userProfileId: string,
  statementId: string,
  input: PayCardStatementInput,
) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  return prisma.$transaction(async (tx) => {
    const statement = await tx.cardStatement.findFirst({
      where: {
        id: statementId,
        householdId: input.householdId,
        deletedAt: null,
      },
      include: {
        creditCard: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!statement) {
      throw new NotFoundError("Card statement not found");
    }

    if (statement.status === CardStatementStatus.PAID || statement.status === CardStatementStatus.ARCHIVED) {
      throw new FieldApiError(400, "Revisá los campos marcados.", {
        amount: "Este resumen ya no tiene saldo pendiente.",
      });
    }

    if (!statement.creditCard.accountId) {
      throw new FieldApiError(400, "Revisá los campos marcados.", {
        sourceAccountId: "La tarjeta necesita una cuenta vinculada para registrar el pago.",
      });
    }

    const sourceAccount = await tx.account.findFirst({
      where: {
        id: input.sourceAccountId,
        householdId: input.householdId,
        deletedAt: null,
        isArchived: false,
      },
      select: {
        id: true,
        currency: true,
      },
    });

    if (!sourceAccount) {
      throw new FieldApiError(400, "Revisá los campos marcados.", {
        sourceAccountId: "La cuenta origen no existe.",
      });
    }

    if (sourceAccount.currency !== statement.currency) {
      throw new FieldApiError(400, "Revisá los campos marcados.", {
        sourceAccountId: "La cuenta origen debe usar la misma moneda que el resumen.",
      });
    }

    const amount = toFiniteNumber(input.amount);
    const pendingAmount = toFiniteNumber(statement.pendingAmount);

    if (amount <= 0) {
      throw new FieldApiError(400, "Revisá los campos marcados.", {
        amount: "Ingresá un monto mayor a cero.",
      });
    }

    if (amount > pendingAmount) {
      throw new FieldApiError(400, "Revisá los campos marcados.", {
        amount: `El pago no puede superar el saldo pendiente (${pendingAmount.toFixed(2)}).`,
      });
    }

    const paidAt = input.paidAt ?? new Date();
    const paymentKind = resolvePaymentKind({
      requestedKind: input.kind,
      amount,
      pendingAmount,
      minimumPayment: statement.minimumPayment,
    });

    const transaction = await tx.transaction.create({
      data: {
        householdId: input.householdId,
        createdById: userProfileId,
        accountId: input.sourceAccountId,
        transferAccountId: statement.creditCard.accountId,
        type: TransactionType.CARD_PAYMENT,
        status: TransactionStatus.CONFIRMED,
        currency: statement.currency,
        amount,
        transferAmount: amount,
        description: `Pago tarjeta: ${statement.creditCard.name}`,
        occurredAt: paidAt,
      },
    });

    await applyBalanceDeltas(
      tx,
      computeTransactionBalanceDeltas({
        type: transaction.type,
        status: transaction.status,
        accountId: transaction.accountId,
        transferAccountId: transaction.transferAccountId,
        amount: transaction.amount,
        transferAmount: transaction.transferAmount,
      }),
    );

    const next = computeCardStatementPaymentResult({
      status: statement.status,
      totalAmount: statement.totalAmount,
      pendingAmount: statement.pendingAmount,
      paidAmount: statement.paidAmount,
      minimumPayment: statement.minimumPayment,
      dueDate: statement.dueDate,
      paymentAmount: amount,
      now: paidAt,
    });

    const [payment, updatedStatement] = await Promise.all([
      tx.cardPayment.create({
        data: {
          householdId: input.householdId,
          creditCardId: statement.creditCardId,
          statementId: statement.id,
          sourceAccountId: input.sourceAccountId,
          transactionId: transaction.id,
          kind: paymentKind,
          currency: statement.currency,
          amount,
          paidAt,
        },
      }),
      tx.cardStatement.update({
        where: { id: statement.id },
        data: {
          paidAmount: next.paidAmount,
          pendingAmount: next.pendingAmount,
          status: next.status,
        },
      }),
    ]);

    await reduceLegacyLinkedCreditCardDebt(tx, {
      accountId: statement.creditCard.accountId,
      amount,
    });

    return {
      payment: {
        id: payment.id,
        statementId: payment.statementId,
        creditCardId: payment.creditCardId,
        sourceAccountId: payment.sourceAccountId,
        transactionId: payment.transactionId,
        kind: payment.kind,
        currency: payment.currency,
        amount: toFiniteNumber(payment.amount),
        paidAt: payment.paidAt.toISOString(),
      },
      statement: serializeStatement({
        ...updatedStatement,
        movementTotal: updatedStatement.totalAmount,
        _count: { transactions: 0, payments: 0 },
      }),
    };
  });
}

export function computeCardStatementPaymentResult(
  input: CardStatementInput & { paymentAmount: Prisma.Decimal | number; now?: Date },
) {
  const paymentAmount = toFiniteNumber(input.paymentAmount);
  const paidAmount = Math.max(toFiniteNumber(input.paidAmount) + paymentAmount, 0);
  const pendingAmount = Math.max(toFiniteNumber(input.pendingAmount) - paymentAmount, 0);

  return {
    paidAmount,
    pendingAmount,
    status: getNextStatementStatus({
      status: input.status,
      pendingAmount,
      paidAmount,
      dueDate: input.dueDate,
      now: input.now ?? new Date(),
    }),
  };
}

export async function linkImportedCardTransactionToStatement(
  userProfileId: string,
  input: { householdId: string; transactionId: string; isTax?: boolean },
) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const transaction = await prisma.transaction.findFirst({
    where: {
      id: input.transactionId,
      householdId: input.householdId,
      origin: TransactionOrigin.CARD_SUMMARY,
      deletedAt: null,
      account: {
        type: AccountType.CREDIT_CARD,
        deletedAt: null,
        isArchived: false,
      },
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
      account: {
        select: {
          id: true,
          name: true,
          currency: true,
          creditLimit: true,
          createdById: true,
        },
      },
    },
  });

  if (!transaction) return null;

  const card = await prisma.creditCard.upsert({
    where: { accountId: transaction.account.id },
    update: {
      name: transaction.account.name,
      currency: transaction.account.currency,
      creditLimit: transaction.account.creditLimit,
      isActive: true,
    },
    create: {
      householdId: input.householdId,
      createdById: transaction.account.createdById ?? userProfileId,
      accountId: transaction.account.id,
      name: transaction.account.name,
      currency: transaction.account.currency,
      creditLimit: transaction.account.creditLimit,
      isActive: true,
    },
    select: { id: true },
  });

  const [statement] = await linkImportedCardTransactionsToStatements({
    householdId: input.householdId,
    creditCardId: card.id,
    transactions: [
      {
        id: transaction.id,
        categoryId: transaction.categoryId,
        description: transaction.description,
        currency: transaction.currency,
        amount: transaction.amount,
        occurredAt: transaction.occurredAt,
        isInstallment: transaction.isInstallment,
        installmentNumber: transaction.installmentNumber,
        totalInstallments: transaction.totalInstallments,
        isTax: input.isTax ?? isTaxDescription(transaction.description),
      },
    ],
  });

  return statement ?? null;
}

export async function applyImportedCardStatementSummary(
  userProfileId: string,
  input: {
    householdId: string;
    accountId: string;
    statementTotal?: number;
    totalConsumptions?: number;
    minimumPayment?: number;
    dueDate?: Date;
    closeDate?: Date;
    periodYear?: number;
    periodMonth?: number;
  },
) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const account = await prisma.account.findFirst({
    where: {
      id: input.accountId,
      householdId: input.householdId,
      type: AccountType.CREDIT_CARD,
      deletedAt: null,
      isArchived: false,
    },
    select: {
      id: true,
      name: true,
      currency: true,
      creditLimit: true,
      createdById: true,
    },
  });

  if (!account) return null;

  const anchor = input.closeDate ?? input.dueDate ?? new Date();
  const fallbackPeriod = argentinaMonthParts(anchor);
  const periodYear = input.periodYear ?? fallbackPeriod.year;
  const periodMonth = input.periodMonth ?? fallbackPeriod.month;
  const { start, end } = argentinaMonthRangeUtc(periodYear, periodMonth);

  const card = await prisma.creditCard.upsert({
    where: { accountId: account.id },
    update: {
      name: account.name,
      currency: account.currency,
      creditLimit: account.creditLimit,
      isActive: true,
    },
    create: {
      householdId: input.householdId,
      createdById: account.createdById ?? userProfileId,
      accountId: account.id,
      name: account.name,
      currency: account.currency,
      creditLimit: account.creditLimit,
      isActive: true,
    },
    select: { id: true },
  });

  const existing = await prisma.cardStatement.findUnique({
    where: {
      creditCardId_periodYear_periodMonth: {
        creditCardId: card.id,
        periodYear,
        periodMonth,
      },
    },
    select: {
      id: true,
      totalAmount: true,
      pendingAmount: true,
      paidAmount: true,
      status: true,
    },
  });

  const importedTotal = input.statementTotal ?? input.totalConsumptions;
  if (importedTotal == null && !existing) return null;

  const totalAmount = importedTotal ?? (existing ? toFiniteNumber(existing.totalAmount) : 0);
  const paidAmount = existing ? toFiniteNumber(existing.paidAmount) : 0;
  const pendingAmount = importedTotal != null
    ? Math.max(totalAmount - paidAmount, 0)
    : existing
      ? toFiniteNumber(existing.pendingAmount)
      : 0;
  const status = getNextStatementStatus({
    status: existing?.status ?? CardStatementStatus.CLOSED_PENDING_PAYMENT,
    pendingAmount,
    paidAmount,
    dueDate: input.dueDate ?? null,
    now: new Date(),
  });

  return prisma.cardStatement.upsert({
    where: {
      creditCardId_periodYear_periodMonth: {
        creditCardId: card.id,
        periodYear,
        periodMonth,
      },
    },
    update: {
      totalAmount,
      pendingAmount,
      minimumPayment: input.minimumPayment,
      dueDate: input.dueDate,
      closeDate: input.closeDate,
      status,
      importedAt: new Date(),
    },
    create: {
      householdId: input.householdId,
      creditCardId: card.id,
      currency: account.currency,
      periodYear,
      periodMonth,
      cycleStartDate: start,
      cycleEndDate: end,
      closeDate: input.closeDate,
      dueDate: input.dueDate,
      status,
      totalAmount,
      pendingAmount,
      paidAmount: 0,
      minimumPayment: input.minimumPayment,
      importedAt: new Date(),
    },
    select: { id: true },
  });
}

function serializeStatement(statement: CardStatementInput & {
  id: string;
  creditCardId: string;
  householdId: string;
  currency: string;
  periodYear: number;
  periodMonth: number;
  cycleStartDate: Date;
  cycleEndDate: Date;
  closeDate: Date | null;
  importedAt: Date | null;
  movementTotal?: Prisma.Decimal | number;
  transactions?: Array<{
    id: string;
    transactionId: string | null;
    description: string | null;
    currency: string;
    amount: Prisma.Decimal | number;
    occurredAt: Date;
    installmentNumber: number | null;
    totalInstallments: number | null;
    isTax: boolean;
    transaction: {
      id: string;
      description: string | null;
      category: { name: string; icon: string | null } | null;
    } | null;
  }>;
  _count?: { transactions: number; payments: number };
}) {
  const movementTotal = toFiniteNumber(statement.movementTotal ?? 0);
  const totalAmount = toFiniteNumber(statement.totalAmount);
  const reconciliationDelta = totalAmount - movementTotal;

  return {
    id: statement.id,
    creditCardId: statement.creditCardId,
    householdId: statement.householdId,
    currency: statement.currency,
    periodYear: statement.periodYear,
    periodMonth: statement.periodMonth,
    cycleStartDate: statement.cycleStartDate.toISOString(),
    cycleEndDate: statement.cycleEndDate.toISOString(),
    closeDate: statement.closeDate?.toISOString() ?? null,
    dueDate: statement.dueDate?.toISOString() ?? null,
    status: statement.status,
    totalAmount,
    pendingAmount: toFiniteNumber(statement.pendingAmount),
    minimumPayment: statement.minimumPayment != null ? toFiniteNumber(statement.minimumPayment) : null,
    paidAmount: toFiniteNumber(statement.paidAmount),
    movementTotal,
    reconciliationDelta,
    isReconciled: Math.abs(reconciliationDelta) < 0.01,
    importedAt: statement.importedAt?.toISOString() ?? null,
    movements: statement.transactions?.map((movement) => ({
      id: movement.id,
      transactionId: movement.transactionId,
      description: movement.transaction?.description ?? movement.description,
      currency: movement.currency,
      amount: toFiniteNumber(movement.amount),
      occurredAt: movement.occurredAt.toISOString(),
      category: movement.transaction?.category ?? null,
      installmentNumber: movement.installmentNumber,
      totalInstallments: movement.totalInstallments,
      isTax: movement.isTax,
    })) ?? [],
    transactionCount: statement._count?.transactions ?? 0,
    paymentCount: statement._count?.payments ?? 0,
  };
}

export async function syncLegacyCreditCards(userProfileId: string, householdId: string) {
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
      creditLimit: true,
      currentBalance: true,
      createdById: true,
      linkedDebts: {
        where: {
          deletedAt: null,
          type: DebtType.CREDIT_CARD,
          status: { in: [DebtStatus.ACTIVE, DebtStatus.PAUSED, DebtStatus.DEFAULTED] },
        },
        select: {
          outstandingAmount: true,
          minimumPayment: true,
          nextDueDate: true,
          dueDay: true,
        },
        take: 1,
      },
      transactions: {
        where: {
          deletedAt: null,
          origin: TransactionOrigin.CARD_SUMMARY,
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
        orderBy: { occurredAt: "asc" },
        take: 500,
      },
    },
    orderBy: { name: "asc" },
  });

  for (const account of accounts) {
    const card = await prisma.creditCard.upsert({
      where: { accountId: account.id },
      update: {
        name: account.name,
        currency: account.currency,
        creditLimit: account.creditLimit,
        isActive: true,
      },
      create: {
        householdId,
        createdById: account.createdById ?? userProfileId,
        accountId: account.id,
        name: account.name,
        currency: account.currency,
        creditLimit: account.creditLimit,
        isActive: true,
      },
      select: {
        id: true,
        statements: { where: { deletedAt: null }, select: { id: true }, take: 1 },
      },
    });

    const linkedDebt = account.linkedDebts[0];
    const accountDebt = Math.max(-toFiniteNumber(account.currentBalance), 0);
    const formalDebt = linkedDebt ? toFiniteNumber(linkedDebt.outstandingAmount) : 0;
    const pendingAmount = Math.max(accountDebt, formalDebt);
    const { year, month } = getArgentinaCurrentMonth();
    const { start, end } = argentinaMonthRangeUtc(year, month);
    const hasImportedTransactions = account.transactions.length > 0;

    if (card.statements.length === 0 && (pendingAmount > 0 || hasImportedTransactions)) {
      await prisma.cardStatement.create({
        data: {
          householdId,
          creditCardId: card.id,
          currency: account.currency,
          periodYear: year,
          periodMonth: month,
          cycleStartDate: start,
          cycleEndDate: end,
          dueDate: linkedDebt?.nextDueDate ?? null,
          status: pendingAmount > 0
            ? getNextStatementStatus({
                status: CardStatementStatus.CLOSED_PENDING_PAYMENT,
                pendingAmount,
                paidAmount: 0,
                dueDate: linkedDebt?.nextDueDate ?? null,
                now: new Date(),
              })
            : CardStatementStatus.OPEN,
          totalAmount: pendingAmount,
          pendingAmount,
          paidAmount: 0,
          minimumPayment: linkedDebt?.minimumPayment ?? null,
          importedAt: hasImportedTransactions ? new Date() : null,
        },
      });
    }

    if (hasImportedTransactions) {
      await linkImportedCardTransactionsToStatements({
        householdId,
        creditCardId: card.id,
        transactions: account.transactions,
      });
    }
  }
}

async function linkImportedCardTransactionsToStatements({
  householdId,
  creditCardId,
  transactions,
}: {
  householdId: string;
  creditCardId: string;
  transactions: ImportedCardTransaction[];
}) {
  const byPeriod = new Map<string, ImportedCardTransaction[]>();
  const linkedStatements: Array<{ id: string }> = [];

  for (const transaction of transactions) {
    const { year, month } = argentinaMonthParts(transaction.occurredAt);
    const key = `${year}-${month}`;
    byPeriod.set(key, [...(byPeriod.get(key) ?? []), transaction]);
  }

  const current = getArgentinaCurrentMonth();

  for (const [key, periodTransactions] of byPeriod) {
    const [year, month] = key.split("-").map(Number);
    const { start, end } = argentinaMonthRangeUtc(year, month);
    const isCurrentPeriod = year === current.year && month === current.month;

    const statement = await prisma.cardStatement.upsert({
      where: {
        creditCardId_periodYear_periodMonth: {
          creditCardId,
          periodYear: year,
          periodMonth: month,
        },
      },
      update: {
        importedAt: new Date(),
      },
      create: {
        householdId,
        creditCardId,
        currency: periodTransactions[0].currency,
        periodYear: year,
        periodMonth: month,
        cycleStartDate: start,
        cycleEndDate: end,
        status: isCurrentPeriod ? CardStatementStatus.OPEN : CardStatementStatus.ARCHIVED,
        totalAmount: 0,
        pendingAmount: 0,
        paidAmount: 0,
        importedAt: new Date(),
      },
      select: { id: true },
    });
    linkedStatements.push(statement);

    await prisma.statementTransaction.createMany({
      data: periodTransactions.map((transaction) => ({
        householdId,
        creditCardId,
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
        isTax: transaction.isTax ?? isTaxDescription(transaction.description),
      })),
      skipDuplicates: true,
    });
  }

  return linkedStatements;
}

export async function addManualMovementToStatement(
  userProfileId: string,
  statementId: string,
  input: { householdId: string; description: string; amount: number; categoryId?: string | null; occurredAt: string },
) {
  await assertHouseholdAccess(userProfileId, input.householdId);

  const statement = await prisma.cardStatement.findFirst({
    where: { id: statementId, householdId: input.householdId, deletedAt: null },
    select: {
      id: true,
      creditCardId: true,
      householdId: true,
      currency: true,
      creditCard: { select: { id: true, accountId: true } },
    },
  });

  if (!statement || !statement.creditCard.accountId) {
    throw new NotFoundError("Resumen no encontrado o la tarjeta no tiene cuenta vinculada.");
  }

  const accountId = statement.creditCard.accountId;
  const amount = new Prisma.Decimal(input.amount);
  const occurredAt = new Date(input.occurredAt);

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        householdId: input.householdId,
        accountId,
        createdById: userProfileId,
        type: TransactionType.EXPENSE,
        origin: TransactionOrigin.CARD_SUMMARY,
        status: TransactionStatus.CONFIRMED,
        currency: statement.currency,
        amount,
        description: input.description,
        categoryId: input.categoryId ?? null,
        occurredAt,
      },
      select: { id: true },
    });

    await tx.statementTransaction.create({
      data: {
        householdId: input.householdId,
        creditCardId: statement.creditCardId,
        statementId: statement.id,
        transactionId: transaction.id,
        description: input.description,
        currency: statement.currency,
        amount,
        occurredAt,
        categoryId: input.categoryId ?? null,
        isTax: false,
      },
    });

    await applyBalanceDeltas(tx, [{ accountId, delta: -input.amount }]);
  });
}

function isTaxDescription(description: string | null) {
  return /\b(iva|iibb|percep|percepcion|retencion|impuesto|pais|ganancias|rg\s*\d+|db\.?\s*rg)\b/i.test(description ?? "");
}

function getNextStatementStatus({
  status,
  pendingAmount,
  paidAmount,
  dueDate,
  now,
}: {
  status: CardStatementStatus;
  pendingAmount: number;
  paidAmount: number;
  dueDate: Date | null;
  now: Date;
}) {
  if (pendingAmount <= 0) return CardStatementStatus.PAID;
  if (dueDate && dueDate < now) return CardStatementStatus.OVERDUE;
  if (paidAmount > 0) return CardStatementStatus.PARTIALLY_PAID;
  if (status === CardStatementStatus.OPEN) return CardStatementStatus.OPEN;
  return CardStatementStatus.CLOSED_PENDING_PAYMENT;
}

function resolvePaymentKind({
  requestedKind,
  amount,
  pendingAmount,
  minimumPayment,
}: {
  requestedKind: CardPaymentKind;
  amount: number;
  pendingAmount: number;
  minimumPayment: Prisma.Decimal | number | null;
}) {
  const min = minimumPayment != null ? toFiniteNumber(minimumPayment) : null;
  if (amount >= pendingAmount) return CardPaymentKind.FULL;
  if (min != null && Math.abs(amount - min) < 0.01) return CardPaymentKind.MINIMUM;
  if (requestedKind !== CardPaymentKind.CUSTOM) return requestedKind;
  return CardPaymentKind.PARTIAL;
}

function getCardPressure(statement: ReturnType<typeof serializeStatement> | null): CardPressure {
  if (!statement || statement.pendingAmount <= 0) return "none";
  if (statement.status === CardStatementStatus.OVERDUE) return "overdue";
  if (!statement.dueDate) return "medium";

  const daysUntilDue = Math.ceil((Date.parse(statement.dueDate) - Date.now()) / 86_400_000);
  if (daysUntilDue <= 3) return "high";
  if (daysUntilDue <= 10) return "medium";
  return "low";
}

function compareStatementUrgency(
  a: ReturnType<typeof serializeStatement>,
  b: ReturnType<typeof serializeStatement>,
) {
  const statusRank: Record<string, number> = {
    OVERDUE: 0,
    CLOSED_PENDING_PAYMENT: 1,
    PARTIALLY_PAID: 2,
  };
  const rank = (status: string) => statusRank[status] ?? 9;
  const byStatus = rank(a.status) - rank(b.status);
  if (byStatus !== 0) return byStatus;
  return Date.parse(a.dueDate ?? a.cycleEndDate) - Date.parse(b.dueDate ?? b.cycleEndDate);
}

async function reduceLegacyLinkedCreditCardDebt(
  tx: Prisma.TransactionClient,
  input: { accountId: string; amount: number },
) {
  const debt = await tx.debt.findFirst({
    where: {
      accountId: input.accountId,
      type: DebtType.CREDIT_CARD,
      status: { in: [DebtStatus.ACTIVE, DebtStatus.DEFAULTED] },
      deletedAt: null,
    },
    select: { id: true, outstandingAmount: true },
  });

  if (!debt) return;

  const nextOutstanding = Math.max(toFiniteNumber(debt.outstandingAmount) - input.amount, 0);
  await tx.debt.update({
    where: { id: debt.id },
    data: {
      outstandingAmount: nextOutstanding,
      ...(nextOutstanding === 0 ? { status: DebtStatus.PAID } : {}),
    },
  });
}

function getArgentinaCurrentMonth() {
  const [year, month] = formatArgentinaDateInput().split("-").map(Number);
  return { year, month };
}
