import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { updateRecurringPaymentSchema } from "@/server/schemas/households";
import {
  deactivateHouseholdRecurringPayment,
  updateHouseholdRecurringPayment,
} from "@/server/services/recurring-payments";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const input = updateRecurringPaymentSchema.parse(body);
    const result = await updateHouseholdRecurringPayment(userProfile.id, id, input);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await params;
    const householdId = request.nextUrl.searchParams.get("householdId") ?? "";
    await deactivateHouseholdRecurringPayment(userProfile.id, id, householdId);
    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
