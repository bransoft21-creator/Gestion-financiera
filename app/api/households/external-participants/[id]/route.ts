import { NextRequest } from "next/server";
import { handleApiError, noContent } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { deleteExternalParticipantSchema } from "@/server/schemas/households";
import { deleteExternalParticipant } from "@/server/services/households";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { userProfile } = await getCurrentUser();
    const { householdId } = deleteExternalParticipantSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    await deleteExternalParticipant(userProfile.id, id, householdId);
    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}
