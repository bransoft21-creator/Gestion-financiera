import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { qualitySignalsSchema } from "@/server/schemas/data-quality";
import { getQualitySignals } from "@/server/services/data-quality";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = qualitySignalsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const signals = await getQualitySignals(userProfile.id, input.householdId);
    return ok(signals);
  } catch (error) {
    return handleApiError(error);
  }
}
