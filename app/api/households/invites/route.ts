import { NextRequest } from "next/server";
import { created, handleApiError } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { createHouseholdInviteSchema } from "@/server/schemas/households";
import { createHouseholdInvite } from "@/server/services/households";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = createHouseholdInviteSchema.parse(await request.json());
    const baseUrl = request.nextUrl.origin;
    const invite = await createHouseholdInvite(userProfile.id, { ...input, baseUrl });

    return created(invite);
  } catch (error) {
    return handleApiError(error);
  }
}
