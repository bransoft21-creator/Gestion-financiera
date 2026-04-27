import { NextRequest } from "next/server";
import { handleApiError, ok } from "../../../../server/api/http";
import { ApiError } from "../../../../server/api/errors";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { updateRecurringExpenseSchema } from "../../../../server/schemas/recurring-expenses";
import {
  deleteRecurringExpense,
  updateRecurringExpense,
} from "../../../../server/services/recurring-expenses";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await context.params;
    const input = updateRecurringExpenseSchema.parse(await request.json());
    const item = await updateRecurringExpense(userProfile.id, id, input);
    return ok(item);
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

    await deleteRecurringExpense(userProfile.id, id, householdId);
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
