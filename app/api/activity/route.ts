import { type NextRequest } from "next/server";
import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPrimaryHousehold } from "@/server/services/workspace";
import {
  expireStaleActivities,
  getActivitySummary,
  listActivities,
  upsertReminderActivities,
  upsertWeeklySignalActivities,
  type ActivityFilter,
} from "@/server/services/activity";

export const runtime = "nodejs";

const VALID_FILTERS: ActivityFilter[] = ["all", "important", "positive", "pending", "archived"];

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const params = request.nextUrl.searchParams;

    const isPreview = params.get("preview") === "1";
    const limit = Math.min(Number(params.get("limit") ?? "40"), 40);
    const rawFilter = params.get("filter") ?? "all";
    const filter: ActivityFilter = VALID_FILTERS.includes(rawFilter as ActivityFilter)
      ? (rawFilter as ActivityFilter)
      : "all";

    // Preview mode: skip generation (lightweight)
    if (!isPreview) {
      const household = await getPrimaryHousehold(userProfile.id);
      await Promise.all([
        upsertWeeklySignalActivities({
          userId: userProfile.id,
          householdId: household.id,
        }),
        upsertReminderActivities({
          userId: userProfile.id,
          householdId: household.id,
        }),
      ]);
    }
    await expireStaleActivities(userProfile.id);

    const [items, summary] = await Promise.all([
      listActivities({
        userId: userProfile.id,
        filter,
        limit,
      }),
      getActivitySummary(userProfile.id),
    ]);

    return ok({ items, summary });
  } catch (error) {
    return handleApiError(error);
  }
}
