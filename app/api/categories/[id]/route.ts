import { NextRequest } from "next/server";
import { ApiError } from "../../../../server/api/errors";
import { handleApiError, ok } from "../../../../server/api/http";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { updateCategorySchema } from "../../../../server/schemas/categories";
import { deleteCategory, updateCategory } from "../../../../server/services/categories";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await context.params;
    const input = updateCategorySchema.parse(await request.json());
    const category = await updateCategory(userProfile.id, id, input);

    return ok(category);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await context.params;
    const householdId = request.nextUrl.searchParams.get("householdId");

    if (!householdId) {
      throw new ApiError(400, "householdId is required");
    }

    await deleteCategory(userProfile.id, id, householdId);

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
