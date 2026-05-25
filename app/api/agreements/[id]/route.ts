import { NextRequest } from "next/server";
import { handleApiError, ok } from "../../../../server/api/http";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { closeAgreementSchema, updateAgreementSchema } from "../../../../server/schemas/personal-agreements";
import { closeAgreement, getAgreement, updateAgreement } from "../../../../server/services/personal-agreements";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await params;
    const agreement = await getAgreement(userProfile.id, id);
    return ok(agreement);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await params;
    const body = await request.json();
    const input = updateAgreementSchema.parse({ ...body, agreementId: id });
    const agreement = await updateAgreement(userProfile.id, input);
    return ok(agreement);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userProfile } = await getCurrentUser();
    const { id } = await params;
    const body = await request.json();
    const input = closeAgreementSchema.parse({ ...body, agreementId: id });
    const agreement = await closeAgreement(userProfile.id, input);
    return ok(agreement);
  } catch (error) {
    return handleApiError(error);
  }
}
