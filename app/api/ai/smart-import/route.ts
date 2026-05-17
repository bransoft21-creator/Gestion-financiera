import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/server/api/http";
import { ApiError, ForbiddenError } from "@/server/api/errors";
import { getCurrentUser } from "@/server/auth/current-user";
import { analyzeFile, assertSmartImportDailyLimit, isSpreadsheetUpload } from "@/server/services/smart-import";
import { getTransactionWorkspace } from "@/server/services/workspace";
import { isSmartImportEnabled } from "@/lib/feature-flags";
import { assertAiQuota } from "@/server/services/ai-usage";
import { traceAi, traceUserId } from "@/server/services/ai-trace";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: NextRequest) {
  try {
    traceAi("AI_SMART_IMPORT_START");
    const { userProfile } = await getCurrentUser();
    traceAi("AI_SMART_IMPORT_AUTH_OK", { user: traceUserId(userProfile.id) });

    if (!isSmartImportEnabled(userProfile.email)) {
      traceAi("AI_SMART_IMPORT_FLAG_BLOCKED", { user: traceUserId(userProfile.id) });
      throw new ForbiddenError("Funcionalidad no disponible.");
    }
    traceAi("AI_SMART_IMPORT_FLAGS_OK", { user: traceUserId(userProfile.id) });

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "Se requiere un archivo.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    traceAi("AI_SMART_IMPORT_FILE_OK", {
      user: traceUserId(userProfile.id),
      mimeType,
      bytes: buffer.length,
    });

    const { household, accounts, categories } = await getTransactionWorkspace(userProfile.id);
    traceAi("AI_SMART_IMPORT_WORKSPACE_OK", {
      user: traceUserId(userProfile.id),
      household: household.id,
      accounts: accounts.length,
      categories: categories.length,
    });
    await assertSmartImportDailyLimit(household.id);
    if (!isSpreadsheetUpload(mimeType, file.name)) {
      await assertAiQuota(userProfile.id, "ai.smart-import");
    }

    const result = await analyzeFile(buffer, mimeType, {
      fileName: file.name,
      userProfileId: userProfile.id,
      householdId: household.id,
      accounts,
      categories,
    });

    traceAi("AI_SMART_IMPORT_DONE", {
      user: traceUserId(userProfile.id),
      candidates: result.candidates.length,
    });
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
