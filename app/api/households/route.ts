import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { createHouseholdSchema } from "@/server/schemas/households";
import { createHousehold, listHouseholds } from "@/server/services/households";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { userProfile } = await getCurrentUser();
    const households = await listHouseholds(userProfile.id);

    return ok(households);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = createHouseholdSchema.parse(await request.json());
    const household = await createHousehold(userProfile.id, input);

    return created(household);
  } catch (error) {
    return handleApiError(error);
  }
}
