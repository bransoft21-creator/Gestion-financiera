import { NextRequest } from "next/server";
import { handleApiError, ok } from "../../../../server/api/http";
import { ApiError } from "../../../../server/api/errors";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { updateAccountSchema } from "../../../../server/schemas/accounts";
import { archiveAccount, unarchiveAccount, updateAccount } from "../../../../server/services/accounts";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await context.params;
    const input = updateAccountSchema.parse(await request.json());
    const account = await updateAccount(userProfile.id, id, input);
    return ok(account);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await context.params;
    const householdId = request.nextUrl.searchParams.get("householdId");
    const action = request.nextUrl.searchParams.get("action") ?? "archive";

    if (!householdId) {
      throw new ApiError(400, "householdId is required");
    }

    const result =
      action === "unarchive"
        ? await unarchiveAccount(userProfile.id, id, householdId)
        : await archiveAccount(userProfile.id, id, householdId);

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
