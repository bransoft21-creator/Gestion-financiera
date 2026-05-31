import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handleApiError } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { markStatementAsPaid } from "@/server/services/credit-cards";

export const runtime = "nodejs";

const schema = z.object({ householdId: z.string().min(1) });

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    await markStatementAsPaid(userProfile.id, id, input);
    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
