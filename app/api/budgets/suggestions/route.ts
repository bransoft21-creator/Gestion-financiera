import { NextRequest } from "next/server";
import { handleApiError, ok } from "../../../../server/api/http";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { budgetPeriodSchema } from "../../../../server/schemas/budgets";
import { listBudgetSuggestions } from "../../../../server/services/budgets";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = budgetPeriodSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const suggestions = await listBudgetSuggestions(userProfile.id, input);

    return ok(suggestions);
  } catch (error) {
    return handleApiError(error);
  }
}
