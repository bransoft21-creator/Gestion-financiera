import { NextRequest } from "next/server";
import { created, handleApiError } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { payCardStatementSchema } from "@/server/schemas/credit-cards";
import { payCardStatement } from "@/server/services/credit-cards";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await context.params;
    const input = payCardStatementSchema.parse(await request.json());
    const result = await payCardStatement(userProfile.id, id, input);
    return created(result);
  } catch (error) {
    return handleApiError(error);
  }
}
