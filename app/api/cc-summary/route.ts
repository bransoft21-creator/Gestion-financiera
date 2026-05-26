import { type NextRequest } from "next/server";
import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { listCCAccountSummaries } from "@/server/services/cc-summary";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const householdId = request.nextUrl.searchParams.get("householdId") ?? "";
    if (!householdId) return ok({ summaries: [] });

    const summaries = await listCCAccountSummaries(userProfile.id, householdId);
    return ok({ summaries });
  } catch (error) {
    return handleApiError(error);
  }
}
