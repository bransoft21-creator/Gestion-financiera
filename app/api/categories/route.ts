import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "../../../server/api/http";
import { getCurrentUser } from "../../../server/auth/current-user";
import { createCategory, listCategories } from "../../../server/services/categories";
import { createCategorySchema, listCategoriesSchema } from "../../../server/schemas/categories";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = listCategoriesSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const categories = await listCategories(userProfile.id, input);

    return ok(categories);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = createCategorySchema.parse(await request.json());
    const category = await createCategory(userProfile.id, input);

    return created(category);
  } catch (error) {
    return handleApiError(error);
  }
}
