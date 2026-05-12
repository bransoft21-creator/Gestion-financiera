import { NextRequest } from "next/server";
import { z } from "zod";
import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import {
  generateMonthlyFinancialAnalysis,
  getSavedMonthlyFinancialAnalysis,
} from "@/server/services/ai-monthly-analysis";
import { getPrimaryHousehold } from "@/server/services/workspace";
import { ForbiddenError } from "@/server/api/errors";
import { isAiEnabled } from "@/lib/feature-flags";
import { assertAiQuota } from "@/server/services/ai-usage";
import { traceAi, traceUserId } from "@/server/services/ai-trace";

export const runtime = "nodejs";

const monthlyAnalysisSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El mes debe tener formato YYYY-MM."),
});

export async function GET(request: NextRequest) {
  try {
    traceAi("AI_MONTHLY_GET_START");
    const { userProfile } = await getCurrentUser();
    traceAi("AI_MONTHLY_AUTH_OK", { user: traceUserId(userProfile.id) });
    if (!isAiEnabled(userProfile.email)) {
      traceAi("AI_MONTHLY_FLAG_BLOCKED", { user: traceUserId(userProfile.id) });
      throw new ForbiddenError("Funcionalidad no disponible.");
    }
    traceAi("AI_MONTHLY_FLAGS_OK", { user: traceUserId(userProfile.id) });

    const household = await getPrimaryHousehold(userProfile.id);
    traceAi("AI_MONTHLY_WORKSPACE_OK", { user: traceUserId(userProfile.id), household: household.id });
    const input = monthlyAnalysisSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const analysis = await getSavedMonthlyFinancialAnalysis({
      userProfileId: userProfile.id,
      householdId: household.id,
      month: input.month,
    });

    traceAi("AI_MONTHLY_GET_DONE", {
      user: traceUserId(userProfile.id),
      month: input.month,
      cached: Boolean(analysis),
    });
    return ok(analysis);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    traceAi("AI_MONTHLY_START");
    const { userProfile } = await getCurrentUser();
    traceAi("AI_MONTHLY_AUTH_OK", { user: traceUserId(userProfile.id) });
    if (!isAiEnabled(userProfile.email)) {
      traceAi("AI_MONTHLY_FLAG_BLOCKED", { user: traceUserId(userProfile.id) });
      throw new ForbiddenError("Funcionalidad no disponible.");
    }
    traceAi("AI_MONTHLY_FLAGS_OK", { user: traceUserId(userProfile.id) });

    const household = await getPrimaryHousehold(userProfile.id);
    traceAi("AI_MONTHLY_WORKSPACE_OK", { user: traceUserId(userProfile.id), household: household.id });
    const input = monthlyAnalysisSchema.parse(await request.json());
    traceAi("AI_MONTHLY_INPUT_OK", { user: traceUserId(userProfile.id), month: input.month });
    await assertAiQuota(userProfile.id, "ai.monthly-analysis");

    const analysis = await generateMonthlyFinancialAnalysis({
      userProfileId: userProfile.id,
      householdId: household.id,
      month: input.month,
    });

    traceAi("AI_MONTHLY_DONE", {
      user: traceUserId(userProfile.id),
      month: input.month,
      cached: analysis.cached,
    });
    return ok(analysis);
  } catch (error) {
    return handleApiError(error);
  }
}
