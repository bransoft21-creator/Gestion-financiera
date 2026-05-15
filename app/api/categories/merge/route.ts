import { NextRequest } from "next/server";
import { handleApiError, ok } from "../../../../server/api/http";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { mergeCategoriesSchema } from "../../../../server/schemas/categories";
import { mergeCategories } from "../../../../server/services/categories";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = mergeCategoriesSchema.parse(await request.json());
    await mergeCategories(userProfile.id, input);

    return ok({ merged: true });
  } catch (error) {
    return handleApiError(error);
  }
}
