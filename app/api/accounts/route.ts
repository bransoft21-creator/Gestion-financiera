import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "../../../server/api/http";
import { getCurrentUser } from "../../../server/auth/current-user";
import { createAccountSchema, listAccountsSchema } from "../../../server/schemas/accounts";
import { createAccount, listAccounts } from "../../../server/services/accounts";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = listAccountsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const result = await listAccounts(userProfile.id, input);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = createAccountSchema.parse(await request.json());
    const account = await createAccount(userProfile.id, input);
    return created(account);
  } catch (error) {
    return handleApiError(error);
  }
}
