import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { createTransaction } from "@/server/services/transactions";
import { importCandidatesSchema } from "@/server/schemas/smart-import";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const body = importCandidatesSchema.parse(await request.json());

    const created = [];
    const errors: { index: number; message: string }[] = [];

    for (let i = 0; i < body.candidates.length; i++) {
      const candidate = body.candidates[i];
      try {
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
        created.push(tx);
      } catch (err) {
        errors.push({
          index: i,
          message: err instanceof Error ? err.message : "Error desconocido.",
        });
      }
    }

    return ok({ created, errors, total: body.candidates.length });
  } catch (error) {
    return handleApiError(error);
  }
}
