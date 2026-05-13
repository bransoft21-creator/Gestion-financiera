import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { createRecurringPaymentSchema, listRecurringPaymentsSchema } from "@/server/schemas/households";
import {
  createHouseholdRecurringPayment,
  listHouseholdRecurringPayments,
} from "@/server/services/recurring-payments";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = listRecurringPaymentsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const result = await listHouseholdRecurringPayments(
      userProfile.id,
      input.householdId,
      input.monthKey,
    );
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = createRecurringPaymentSchema.parse(await request.json());
    const result = await createHouseholdRecurringPayment(userProfile.id, input);
    return created(result);
  } catch (error) {
    return handleApiError(error);
  }
}
