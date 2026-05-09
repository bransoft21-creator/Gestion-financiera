import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { generateMonthlyFinancialAnalysis } from "@/server/services/ai-monthly-analysis";
import { getPrimaryHousehold } from "@/server/services/workspace";

export const runtime = "nodejs";

const monthlyAnalysisSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El mes debe tener formato YYYY-MM."),
});

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const household = await getPrimaryHousehold(userProfile.id);
    const input = monthlyAnalysisSchema.parse(await request.json());

    const analysis = await generateMonthlyFinancialAnalysis({
      userProfileId: userProfile.id,
      householdId: household.id,
      month: input.month,
    });

    return ok(analysis);
  } catch (error) {
    return handleApiError(error);
  }
}
