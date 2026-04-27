import { NextRequest } from "next/server";
import { handleApiError, ok } from "../../../../server/api/http";
import { ApiError } from "../../../../server/api/errors";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { updateDebtSchema } from "../../../../server/schemas/debts";
import { deleteDebt, updateDebt } from "../../../../server/services/debts";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await context.params;
    const input = updateDebtSchema.parse(await request.json());
    const debt = await updateDebt(userProfile.id, id, input);
    return ok(debt);
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

    await deleteDebt(userProfile.id, id, householdId);
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
