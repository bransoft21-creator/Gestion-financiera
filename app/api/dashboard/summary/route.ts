import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok } from "../../../../server/api/http";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { getDashboardSummary } from "../../../../server/services/dashboard";
import { getPrimaryHousehold } from "../../../../server/services/workspace";

export const runtime = "nodejs";

const periodSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const household = await getPrimaryHousehold(userProfile.id);

    const now = new Date();
    const { year = now.getFullYear(), month = now.getMonth() + 1 } = periodSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const summary = await getDashboardSummary(userProfile.id, household.id, year, month);
    return ok(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
