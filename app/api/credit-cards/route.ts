import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { listCreditCardsSchema } from "@/server/schemas/credit-cards";
import { listCreditCards } from "@/server/services/credit-cards";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = listCreditCardsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const result = await listCreditCards(userProfile.id, input);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
