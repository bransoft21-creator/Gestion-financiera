import { NextRequest } from "next/server";
import { handleApiError, ok } from "../../../../../server/api/http";
import { getCurrentUser } from "../../../../../server/auth/current-user";
import { toggleRecurringExpenseSchema } from "../../../../../server/schemas/recurring-expenses";
import { toggleRecurringExpense } from "../../../../../server/services/recurring-expenses";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await context.params;
    const { householdId, isActive } = toggleRecurringExpenseSchema.parse(await request.json());
    const item = await toggleRecurringExpense(userProfile.id, id, householdId, isActive);
    return ok(item);
  } catch (error) {
    return handleApiError(error);
  }
}
