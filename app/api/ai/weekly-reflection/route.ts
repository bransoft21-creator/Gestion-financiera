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

export const runtime = "nodejs";

/** GET — returns the saved reflection for the current week (no AI call) */
export async function GET() {
  try {
    const { userProfile } = await getCurrentUser();
    if (!isAiEnabled(userProfile.email)) {
      throw new ForbiddenError("Funcionalidad no disponible.");
    }

    const data = await getSavedWeeklyReflection({ userProfileId: userProfile.id });
    return ok(data);
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST — generates (or returns cached) reflection for the current week */
export async function POST() {
  try {
    const { userProfile } = await getCurrentUser();
    if (!isAiEnabled(userProfile.email)) {
      throw new ForbiddenError("Funcionalidad no disponible.");
    }

    const household = await getPrimaryHousehold(userProfile.id);
    await assertAiQuota(userProfile.id, "ai.weekly-reflection");
    const data = await getOrGenerateWeeklyReflection({
      userProfileId: userProfile.id,
      householdId: household.id,
    });

    return ok(data);
  } catch (error) {
    return handleApiError(error);
  }
}
