import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "../../../server/api/http";
import { getCurrentUser } from "../../../server/auth/current-user";
import { createTransaction, listTransactions } from "../../../server/services/transactions";
import {
  createTransactionSchema,
  listTransactionsSchema,
} from "../../../server/schemas/transactions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = listTransactionsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const transactions = await listTransactions(userProfile.id, input);

    return ok(transactions);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = createTransactionSchema.parse(await request.json());
    const transaction = await createTransaction(userProfile.id, input);

    return created(transaction);
  } catch (error) {
    return handleApiError(error);
  }
}
