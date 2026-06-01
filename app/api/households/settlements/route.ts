import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { createSettlementSchema, listSettlementsSchema } from "@/server/schemas/households";
import { createHouseholdSettlement, listHouseholdSettlements } from "@/server/services/households";
import { createTransaction } from "@/server/services/transactions";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/server/api/errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = listSettlementsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const settlements = await listHouseholdSettlements(userProfile.id, input.householdId);

    return ok(settlements);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = createSettlementSchema.parse(await request.json());

    const settlement = await createHouseholdSettlement(userProfile.id, {
      householdId: input.householdId,
      amount: input.amount,
      notes: input.notes,
    });

    // If the caller provided an account, create an EXPENSE so the payment
    // shows up in their personal Movimientos.
    let transactionId: string | null = null;
    if (input.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: input.accountId, deletedAt: null },
        select: { householdId: true, currency: true },
      });
      if (!account) throw new NotFoundError("Cuenta no encontrada.");

      const tx = await createTransaction(userProfile.id, {
        householdId: account.householdId,
        accountId: input.accountId,
        type: "EXPENSE",
        status: "CONFIRMED",
        currency: account.currency,
        amount: input.amount,
        description: "Compensación de hogar",
        origin: "MANUAL",
        isInstallment: false,
        isRecurring: false,
        occurredAt: new Date(),
      });
      transactionId = tx.id;
    }

    return created({ ...settlement, transactionId });
  } catch (error) {
    return handleApiError(error);
  }
}
