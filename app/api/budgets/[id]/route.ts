import { NextRequest } from "next/server";
import { ApiError } from "../../../../server/api/errors";
import { handleApiError, ok } from "../../../../server/api/http";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { updateBudgetSchema } from "../../../../server/schemas/budgets";
import { deleteBudget, updateBudget } from "../../../../server/services/budgets";

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
    const input = updateBudgetSchema.parse(await request.json());
    const budget = await updateBudget(userProfile.id, id, input);

    return ok(budget);
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

    await deleteBudget(userProfile.id, id, householdId);

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
