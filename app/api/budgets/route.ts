import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "../../../server/api/http";
import { getCurrentUser } from "../../../server/auth/current-user";
import { budgetPeriodSchema, createBudgetSchema } from "../../../server/schemas/budgets";
import { createBudget, listBudgets } from "../../../server/services/budgets";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = budgetPeriodSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const budgets = await listBudgets(userProfile.id, input);

    return ok(budgets);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = createBudgetSchema.parse(await request.json());
    const budget = await createBudget(userProfile.id, input);

    return created(budget);
  } catch (error) {
    return handleApiError(error);
  }
}
