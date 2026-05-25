import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { verifyLedgerInvariant } from "@/server/services/ledger-audit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { userProfile } = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get("householdId");
    if (!householdId) {
      return Response.json({ error: "householdId requerido." }, { status: 400 });
    }
    const report = await verifyLedgerInvariant(userProfile.id, householdId);
    return ok(report);
  } catch (error) {
    return handleApiError(error);
  }
}
