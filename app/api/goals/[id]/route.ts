import { NextRequest } from "next/server";
import { ApiError } from "../../../../server/api/errors";
import { handleApiError, ok } from "../../../../server/api/http";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { updateGoalSchema } from "../../../../server/schemas/goals";
import { deleteGoal, updateGoal } from "../../../../server/services/goals";

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
    const input = updateGoalSchema.parse(await request.json());
    const goal = await updateGoal(userProfile.id, id, input);

    return ok(goal);
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

    await deleteGoal(userProfile.id, id, householdId);

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
