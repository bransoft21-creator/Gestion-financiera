import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { payRecurringExpenseSchema } from "@/server/schemas/recurring-expenses";
import { payRecurringExpense } from "@/server/services/recurring-expenses";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await params;
    const input = payRecurringExpenseSchema.parse(await request.json());
    const result = await payRecurringExpense(userProfile.id, id, input);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
