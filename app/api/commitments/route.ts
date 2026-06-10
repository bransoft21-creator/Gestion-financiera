import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handleApiError } from "../../../server/api/http";
import { getCurrentUser } from "../../../server/auth/current-user";
import { getCommitments } from "../../../server/services/commitments";

export const runtime = "nodejs";

const querySchema = z.object({
  householdId: z.string().min(1),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = querySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const result = await getCommitments(userProfile.id, input.householdId, input.monthKey);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
