import { NextRequest } from "next/server";
import { z } from "zod";
import {
  CARD_RECONCILIATION_APPLY_CONFIRMATION,
  applyCardReconciliation,
} from "@/server/services/card-reconciliation-apply";
import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";

export const runtime = "nodejs";

const applyCardReconciliationSchema = z.object({
  householdId: z.string().min(1, "householdId requerido."),
  confirm: z.literal(CARD_RECONCILIATION_APPLY_CONFIRMATION),
});

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = applyCardReconciliationSchema.parse(await request.json());
    const result = await applyCardReconciliation(userProfile.id, input);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
