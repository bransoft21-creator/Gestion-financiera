import { NextRequest } from "next/server";
import { handleApiError, ok } from "../../../../server/api/http";
import { ApiError } from "../../../../server/api/errors";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { updateTransactionSchema } from "../../../../server/schemas/transactions";
import {
  deleteTransaction,
  updateTransaction,
} from "../../../../server/services/transactions";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await context.params;
    const input = updateTransactionSchema.parse(await request.json());
    const transaction = await updateTransaction(userProfile.id, id, input);

    return ok(transaction);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await context.params;
    const householdId = request.nextUrl.searchParams.get("householdId");

    if (!householdId) {
      throw new ApiError(400, "householdId is required");
    }

    await deleteTransaction(userProfile.id, id, householdId);

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
