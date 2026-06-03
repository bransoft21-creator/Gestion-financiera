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

    // Capture the previous settlement date before creating the new one,
    // so we know which shared expenses to reconcile.
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

    // If the debtor provided their account, create an EXPENSE so the payment
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

    // Reconcile the creditor's shared expenses: for every expense the creditor
    // fronted since the previous settlement, set the transaction amount to their
    // actual share (userShareAmount) and credit the difference back to the account.
    // This way Movimientos shows the true net cost without any extra transactions.
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
            },
          },
        },
      });

      for (const shared of sharedExpenses) {
        const tx = shared.transaction;
        if (tx.userShareAmount === null) continue;

        const fullAmount = Number(tx.amount);
        const shareAmount = Number(tx.userShareAmount);
        const recovery = fullAmount - shareAmount;
        if (recovery <= 0) continue;

        await prisma.$transaction([
          // Set amount to the user's actual share and clear userShareAmount
          // (it's no longer pending — the transaction now reflects the final cost).
          prisma.transaction.update({
            where: { id: tx.id },
            data: { amount: shareAmount, userShareAmount: null },
          }),
          // Credit the recovered amount back to the account so the balance is correct.
          prisma.account.update({
            where: { id: tx.accountId },
            data: { currentBalance: { increment: recovery } },
          }),
        ]);
      }
    }

    return created({ ...settlement, transactionId });
  } catch (error) {
    return handleApiError(error);
  }
}
