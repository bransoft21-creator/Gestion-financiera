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

    // Find the previous settlement date to bound the shared expense query.
    const prevSettlement = await prisma.householdSettlement.findFirst({
      where: { householdId: input.householdId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const settlement = await createHouseholdSettlement(userProfile.id, {
      householdId: input.householdId,
      amount: input.amount,
      notes: input.notes,
    });

    // Debtor paid from their account → record EXPENSE so the payment shows in Movimientos.
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

    // Auto-adjust for the creditor: find every shared expense they fronted since the
    // previous settlement and create an ADJUSTMENT on the same account for the recovery
    // amount (total paid − their own share). This way their Movimientos reflects the
    // net cost without inflating income metrics.
    if (input.creditorUserId) {
      const sharedExpenses = await prisma.sharedTransaction.findMany({
        where: {
          householdId: input.householdId,
          paidByUserId: input.creditorUserId,
          ...(prevSettlement ? { createdAt: { gte: prevSettlement.createdAt } } : {}),
          transaction: { deletedAt: null, status: { not: "CANCELED" } },
        },
        select: {
          transaction: {
            select: {
              id: true,
              amount: true,
              userShareAmount: true,
              accountId: true,
              currency: true,
              householdId: true,
              description: true,
            },
          },
        },
      });

      for (const shared of sharedExpenses) {
        const tx = shared.transaction;
        const fullAmount = Number(tx.amount);
        const shareAmount = tx.userShareAmount !== null ? Number(tx.userShareAmount) : fullAmount;
        const recovery = fullAmount - shareAmount;
        if (recovery <= 0) continue;

        await createTransaction(userProfile.id, {
          householdId: tx.householdId,
          accountId: tx.accountId,
          type: "ADJUSTMENT",
          status: "CONFIRMED",
          currency: tx.currency as "ARS" | "USD",
          amount: recovery,
          description: `Reintegro · ${tx.description ?? "Gasto compartido"}`,
          origin: "MANUAL",
          isInstallment: false,
          isRecurring: false,
          occurredAt: new Date(),
        });
      }
    }

    return created({ ...settlement, transactionId });
  } catch (error) {
    return handleApiError(error);
  }
}
