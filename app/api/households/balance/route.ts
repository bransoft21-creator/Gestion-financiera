import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { householdBalanceSchema } from "@/server/schemas/households";
import { getHouseholdBalance } from "@/server/services/households";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = householdBalanceSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const balance = await getHouseholdBalance(userProfile.id, input.householdId);

    return ok(balance);
  } catch (error) {
    return handleApiError(error);
  }
}
