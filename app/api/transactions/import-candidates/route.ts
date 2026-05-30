import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/server/api/http";
import { ForbiddenError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/current-user";
import { createTransaction } from "@/server/services/transactions";
import {
  applyImportedCardStatementSummary,
  linkImportedCardTransactionToStatement,
} from "@/server/services/credit-cards";
import { importCandidatesSchema } from "@/server/schemas/smart-import";
import { isSmartImportEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();

    if (!isSmartImportEnabled(userProfile.email)) {
      throw new ForbiddenError("Funcionalidad no disponible.");
    }

    const body = importCandidatesSchema.parse(await request.json());

    const created = [];
    const errors: { index: number; message: string }[] = [];

    for (let i = 0; i < body.candidates.length; i++) {
      const candidate = body.candidates[i];
      try {
        const existing = await prisma.transaction.findFirst({
          where: {
            householdId: body.householdId,
            accountId: candidate.accountId,
            amount: candidate.amount,
            occurredAt: candidate.occurredAt,
            description: candidate.description,
            origin: candidate.origin,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (existing) {
          errors.push({
            index: i,
            message: "Ya existe una transacción igual importada.",
          });
          continue;
        }

        const tx = await createTransaction(userProfile.id, {
          householdId: body.householdId,
          accountId: candidate.accountId,
          categoryId: candidate.categoryId,
          type: candidate.type,
          currency: candidate.currency,
          amount: candidate.amount,
          description: candidate.description,
          notes: candidate.notes,
          expenseType: candidate.expenseType,
          origin: candidate.origin,
          paymentMethod: candidate.paymentMethod,
          isInstallment: candidate.isInstallment,
          installmentNumber: candidate.installmentNumber,
          totalInstallments: candidate.totalInstallments,
          occurredAt: candidate.occurredAt,
          status: candidate.status,
          isRecurring: false,
        });

        if (candidate.origin === "CARD_SUMMARY") {
          await linkImportedCardTransactionToStatement(userProfile.id, {
            householdId: body.householdId,
            transactionId: tx.id,
            isTax: candidate.isTax,
          });
        }

        created.push(tx);
      } catch (err) {
        errors.push({
          index: i,
          message: err instanceof Error ? err.message : "Error desconocido.",
        });
      }
    }

    const cardSummaryAccountIds = Array.from(
      new Set(
        body.candidates
          .filter((candidate) => candidate.origin === "CARD_SUMMARY")
          .map((candidate) => candidate.accountId),
      ),
    );

    if (body.statementSummary && cardSummaryAccountIds.length === 1 && created.length > 0) {
      try {
        await applyImportedCardStatementSummary(userProfile.id, {
          householdId: body.householdId,
          accountId: cardSummaryAccountIds[0],
          statementTotal: body.statementSummary.statementTotal ?? undefined,
          totalConsumptions: body.statementSummary.totalConsumptions ?? undefined,
          minimumPayment: body.statementSummary.minimumPayment ?? undefined,
          dueDate: body.statementSummary.dueDate ?? undefined,
          closeDate: body.statementSummary.closeDate ?? undefined,
          periodYear: body.statementSummary.periodYear ?? undefined,
          periodMonth: body.statementSummary.periodMonth ?? undefined,
        });
      } catch (err) {
        errors.push({
          index: -1,
          message: err instanceof Error ? err.message : "No se pudo actualizar el resumen de tarjeta.",
        });
      }
    }

    return ok({ created, errors, total: body.candidates.length });
  } catch (error) {
    return handleApiError(error);
  }
}
