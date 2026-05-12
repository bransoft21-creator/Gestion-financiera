import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/server/api/http";
import { ApiError, ForbiddenError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/current-user";
import { analyzeFile } from "@/server/services/smart-import";
import { getTransactionWorkspace } from "@/server/services/workspace";
import { isSmartImportEnabled } from "@/lib/feature-flags";
import { assertAiQuota } from "@/server/services/ai-usage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();

    if (!isSmartImportEnabled(userProfile.email)) {
      throw new ForbiddenError("Funcionalidad no disponible.");
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "Se requiere un archivo.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";

    const { household, accounts, categories } = await getTransactionWorkspace(userProfile.id);
    await assertAiQuota(userProfile.id, "ai.smart-import");

    const result = await analyzeFile(buffer, mimeType, {
      userProfileId: userProfile.id,
      householdId: household.id,
      accounts,
      categories,
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
