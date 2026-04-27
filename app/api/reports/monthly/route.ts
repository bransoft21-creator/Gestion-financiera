import { NextRequest } from "next/server";
import { handleApiError, ok } from "../../../../server/api/http";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { monthlyReportSchema } from "../../../../server/schemas/reports";
import { getMonthlyReport } from "../../../../server/services/reports";
import { getPrimaryHousehold } from "../../../../server/services/workspace";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = monthlyReportSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const result = await getMonthlyReport(userProfile.id, input);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
