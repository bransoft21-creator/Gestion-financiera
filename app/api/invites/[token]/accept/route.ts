import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { acceptHouseholdInvite } from "@/server/services/households";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { userProfile } = await getCurrentUser();
    const { token } = await context.params;
    const member = await acceptHouseholdInvite(userProfile.id, token);

    return ok(member);
  } catch (error) {
    return handleApiError(error);
  }
}
