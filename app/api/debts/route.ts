import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "../../../server/api/http";
import { getCurrentUser } from "../../../server/auth/current-user";
import { createDebtSchema, listDebtsSchema } from "../../../server/schemas/debts";
import { createDebt, listDebts } from "../../../server/services/debts";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = listDebtsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const result = await listDebts(userProfile.id, input);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = createDebtSchema.parse(await request.json());
    const debt = await createDebt(userProfile.id, input);
    return created(debt);
  } catch (error) {
    return handleApiError(error);
  }
}
