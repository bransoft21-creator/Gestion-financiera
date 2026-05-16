import { ok, handleApiError } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { bulkCategorizeSchema } from "@/server/schemas/data-quality";
import { bulkCategorizeTransactions } from "@/server/services/data-quality";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = bulkCategorizeSchema.parse(await request.json());
    const result = await bulkCategorizeTransactions(userProfile.id, input);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
