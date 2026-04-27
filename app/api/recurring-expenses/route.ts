import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "../../../server/api/http";
import { getCurrentUser } from "../../../server/auth/current-user";
import {
  createRecurringExpenseSchema,
  listRecurringExpensesSchema,
} from "../../../server/schemas/recurring-expenses";
import {
  createRecurringExpense,
  listRecurringExpenses,
} from "../../../server/services/recurring-expenses";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = listRecurringExpensesSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const result = await listRecurringExpenses(userProfile.id, input);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = createRecurringExpenseSchema.parse(await request.json());
    const item = await createRecurringExpense(userProfile.id, input);
    return created(item);
  } catch (error) {
    return handleApiError(error);
  }
}
