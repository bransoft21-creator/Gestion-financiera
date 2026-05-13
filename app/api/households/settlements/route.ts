import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { createSettlementSchema, listSettlementsSchema } from "@/server/schemas/households";
import { createHouseholdSettlement, listHouseholdSettlements } from "@/server/services/households";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = listSettlementsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const settlements = await listHouseholdSettlements(userProfile.id, input.householdId);

    return ok(settlements);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = createSettlementSchema.parse(await request.json());
    const settlement = await createHouseholdSettlement(userProfile.id, input);

    return created(settlement);
  } catch (error) {
    return handleApiError(error);
  }
}
