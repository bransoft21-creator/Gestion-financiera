import { z } from "zod";
import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPrimaryHousehold } from "@/server/services/workspace";
import { ForbiddenError } from "@/server/api/errors";
import { isCopilotEnabled } from "@/lib/feature-flags";
import { traceAi, traceUserId } from "@/server/services/ai-trace";
import { runCopilotQuery } from "@/server/services/copilot-query";
import { formatArgentinaDateInput } from "@/lib/dates";
import { getPeriodStatus } from "@/lib/period-status";

export const runtime = "nodejs";

const querySchema = z.object({
  message: z
    .string()
    .min(1, "El mensaje no puede estar vacío.")
    .max(500, "El mensaje es demasiado largo."),
  year: z.number().int().min(2000).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
}).refine((value) => (value.year === undefined) === (value.month === undefined), {
  message: "Year y month deben enviarse juntos.",
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

    const [defaultYear, defaultMonth] = formatArgentinaDateInput().split("-").map(Number);
    const year = body.data.year ?? defaultYear;
    const month = body.data.month ?? defaultMonth;
    const periodStatus = getPeriodStatus(year, month);

    const result = await runCopilotQuery({
      userProfileId: userProfile.id,
      householdId: household.id,
      message: body.data.message,
      year,
      month,
      periodStatus,
    });

    traceAi("COPILOT_POST_OK", { user: traceUserId(userProfile.id), intent: result.intent });
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
