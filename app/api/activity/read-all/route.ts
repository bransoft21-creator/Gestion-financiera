import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { markAllRead } from "@/server/services/activity";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { userProfile } = await getCurrentUser();
    await markAllRead(userProfile.id);
    return ok({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
