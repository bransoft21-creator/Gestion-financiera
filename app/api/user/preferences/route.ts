import { handleApiError, ok } from "../../../../server/api/http";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { updatePreferencesSchema } from "../../../../server/schemas/user-preferences";
import { getUserPreferences, updateUserPreferences } from "../../../../server/services/user-preferences";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { userProfile } = await getCurrentUser();
    const prefs = await getUserPreferences(userProfile.id);
    return ok(prefs);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { userProfile } = await getCurrentUser();
    const body = await request.json() as unknown;
    const input = updatePreferencesSchema.parse(body);
    const prefs = await updateUserPreferences(userProfile.id, input);
    return ok(prefs);
  } catch (error) {
    return handleApiError(error);
  }
}
