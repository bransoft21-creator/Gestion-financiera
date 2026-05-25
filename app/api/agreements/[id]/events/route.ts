import { NextRequest } from "next/server";
import { created, handleApiError } from "../../../../../server/api/http";
import { getCurrentUser } from "../../../../../server/auth/current-user";
import { createAgreementEventSchema } from "../../../../../server/schemas/personal-agreements";
import { createAgreementEvent } from "../../../../../server/services/personal-agreements";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await params;
    const body = await request.json();
    const input = createAgreementEventSchema.parse({ ...body, agreementId: id });
    const agreement = await createAgreementEvent(userProfile.id, input);
    return created(agreement);
  } catch (error) {
    return handleApiError(error);
  }
}
