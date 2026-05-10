import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/server/api/http";
import { ApiError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/current-user";
import { analyzeFile } from "@/server/services/smart-import";
import { getTransactionWorkspace } from "@/server/services/workspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "Se requiere un archivo.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";

    const { household, accounts, categories } = await getTransactionWorkspace(userProfile.id);

    const result = await analyzeFile(buffer, mimeType, {
      householdId: household.id,
      accounts,
      categories,
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
