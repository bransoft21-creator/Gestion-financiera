import { NextRequest } from "next/server";
import { z } from "zod";
import { created, handleApiError } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { moneySchema } from "@/lib/money";
import { addManualMovementToStatement } from "@/server/services/credit-cards";

export const runtime = "nodejs";

const addMovementSchema = z.object({
  householdId: z.string().min(1),
  description: z.string().trim().min(1).max(200),
  amount: moneySchema(),
  categoryId: z.string().nullable().optional(),
  occurredAt: z.string().min(1),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await context.params;
    const input = addMovementSchema.parse(await request.json());
    await addManualMovementToStatement(userProfile.id, id, input);
    return created({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
