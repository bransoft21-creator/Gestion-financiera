import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { ForbiddenError } from "@/server/api/errors";
import { isAiEnabled } from "@/lib/feature-flags";
import { getPrimaryHousehold } from "@/server/services/workspace";
import { assertAiQuota } from "@/server/services/ai-usage";
import {
  getOrGenerateWeeklyReflection,
  getSavedWeeklyReflection,
} from "@/server/services/weekly-reflection";
import { traceAi, traceUserId } from "@/server/services/ai-trace";

export const runtime = "nodejs";

/** GET — returns the saved reflection for the current week (no AI call) */
export async function GET() {
  try {
    traceAi("AI_WEEKLY_GET_START");
    const { userProfile } = await getCurrentUser();
    traceAi("AI_WEEKLY_AUTH_OK", { user: traceUserId(userProfile.id) });
    if (!isAiEnabled(userProfile.email)) {
      traceAi("AI_WEEKLY_FLAG_BLOCKED", { user: traceUserId(userProfile.id) });
      throw new ForbiddenError("Funcionalidad no disponible.");
    }
    traceAi("AI_WEEKLY_FLAGS_OK", { user: traceUserId(userProfile.id) });

    const data = await getSavedWeeklyReflection({ userProfileId: userProfile.id });
    traceAi("AI_WEEKLY_GET_DONE", { cached: Boolean(data), user: traceUserId(userProfile.id) });
    return ok(data);
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST — generates (or returns cached) reflection for the current week */
export async function POST() {
  try {
    traceAi("AI_WEEKLY_START");
    const { userProfile } = await getCurrentUser();
    traceAi("AI_WEEKLY_AUTH_OK", { user: traceUserId(userProfile.id) });
    if (!isAiEnabled(userProfile.email)) {
      traceAi("AI_WEEKLY_FLAG_BLOCKED", { user: traceUserId(userProfile.id) });
      throw new ForbiddenError("Funcionalidad no disponible.");
    }
    traceAi("AI_WEEKLY_FLAGS_OK", { user: traceUserId(userProfile.id) });

    const household = await getPrimaryHousehold(userProfile.id);
    traceAi("AI_WEEKLY_WORKSPACE_OK", { user: traceUserId(userProfile.id), household: household.id });
    await assertAiQuota(userProfile.id, "ai.weekly-reflection");
    const data = await getOrGenerateWeeklyReflection({
      userProfileId: userProfile.id,
      householdId: household.id,
    });

    traceAi("AI_WEEKLY_DONE", {
      user: traceUserId(userProfile.id),
      cached: data.cached,
      hasData: data.hasData,
    });
    return ok(data);
  } catch (error) {
    return handleApiError(error);
  }
}
