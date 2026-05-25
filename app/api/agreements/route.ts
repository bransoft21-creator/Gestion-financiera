import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "../../../server/api/http";
import { getCurrentUser } from "../../../server/auth/current-user";
import { createAgreementSchema, listAgreementsSchema } from "../../../server/schemas/personal-agreements";
import { createAgreement, listAgreements } from "../../../server/services/personal-agreements";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = listAgreementsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const result = await listAgreements(userProfile.id, input);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = createAgreementSchema.parse(await request.json());
    const agreement = await createAgreement(userProfile.id, input);
    return created(agreement);
  } catch (error) {
    return handleApiError(error);
  }
}
