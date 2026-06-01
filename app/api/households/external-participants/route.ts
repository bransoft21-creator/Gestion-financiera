import { NextRequest } from "next/server";
import { created, handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { createExternalParticipantSchema } from "@/server/schemas/households";
import { createExternalParticipant, listExternalParticipants } from "@/server/services/households";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const householdId = request.nextUrl.searchParams.get("householdId") ?? "";
    const participants = await listExternalParticipants(userProfile.id, householdId);
    return ok(participants);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const input = createExternalParticipantSchema.parse(await request.json());
    const participant = await createExternalParticipant(userProfile.id, input);
    return created(participant);
  } catch (error) {
    return handleApiError(error);
  }
}
