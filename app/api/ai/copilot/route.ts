import { z } from "zod";
import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPrimaryHousehold } from "@/server/services/workspace";
import { ForbiddenError } from "@/server/api/errors";
import { isCopilotEnabled } from "@/lib/feature-flags";
import { traceAi, traceUserId } from "@/server/services/ai-trace";
import { runCopilotQuery } from "@/server/services/copilot-query";

export const runtime = "nodejs";

const querySchema = z.object({
  message: z
    .string()
    .min(1, "El mensaje no puede estar vacío.")
    .max(500, "El mensaje es demasiado largo."),
});

export async function POST(request: Request) {
  try {
    traceAi("COPILOT_POST_START");
    const { userProfile } = await getCurrentUser();
    traceAi("COPILOT_AUTH_OK", { user: traceUserId(userProfile.id) });

    if (!isCopilotEnabled(userProfile.email)) {
      traceAi("COPILOT_FLAG_BLOCKED", { user: traceUserId(userProfile.id) });
      throw new ForbiddenError("El Copiloto Financiero no está disponible para tu cuenta.");
    }

    const body = querySchema.safeParse(await request.json());
    if (!body.success) {
      return Response.json({ error: body.error.issues[0]?.message ?? "Mensaje inválido." }, { status: 400 });
    }

    const household = await getPrimaryHousehold(userProfile.id);
    traceAi("COPILOT_WORKSPACE_OK", { user: traceUserId(userProfile.id), household: household.id });

    const result = await runCopilotQuery({
      userProfileId: userProfile.id,
      householdId: household.id,
      message: body.data.message,
    });

    traceAi("COPILOT_POST_OK", { user: traceUserId(userProfile.id), intent: result.intent });
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
