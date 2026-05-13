import { NextRequest } from "next/server";
import { created, handleApiError } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { markRecurringPaymentAsPaidSchema } from "@/server/schemas/households";
import { markRecurringPaymentAsPaid } from "@/server/services/recurring-payments";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await params;
    const input = markRecurringPaymentAsPaidSchema.parse(await request.json());
    const result = await markRecurringPaymentAsPaid(userProfile.id, id, input);
    return created(result);
  } catch (error) {
    return handleApiError(error);
  }
}
