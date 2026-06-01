import { NextRequest } from "next/server";
import { created, handleApiError } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { createSharedExpenseSchema } from "@/server/schemas/households";
import { prisma } from "@/lib/prisma";
import { assertCollaborativeHouseholdAccess } from "@/server/services/households";
import { createTransaction } from "@/server/services/transactions";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = createSharedExpenseSchema.parse(await request.json());

    await assertCollaborativeHouseholdAccess(userProfile.id, input.householdId);

    const account = await prisma.account.findFirst({
      where: { id: input.accountId, deletedAt: null },
      select: { householdId: true },
    });
    if (!account) {
      return new Response(JSON.stringify({ error: "Cuenta no encontrada." }), { status: 404 });
    }

    const splitConfig = input.splitMode !== "EQUAL" && input.participants?.length
      ? { mode: input.splitMode, participants: input.participants }
      : { mode: "EQUAL" as const };

    const transaction = await createTransaction(userProfile.id, {
      householdId: account.householdId,
      accountId: input.accountId,
      type: "EXPENSE" as const,
      status: "CONFIRMED" as const,
      currency: input.currency,
      amount: input.amount,
      description: input.description,
      categoryId: input.categoryId ?? undefined,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
      isInstallment: false,
      isRecurring: false,
      origin: "MANUAL" as const,
      sharedHouseholdId: input.householdId,
      splitConfig,
    });

    return created({ transactionId: transaction.id });
  } catch (error) {
    return handleApiError(error);
  }
}
