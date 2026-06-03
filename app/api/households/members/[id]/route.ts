import { NextRequest } from "next/server";
import { handleApiError, noContent } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError } from "@/server/api/errors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { userProfile } = await getCurrentUser();

    const membership = await prisma.householdMember.findFirst({
      where: { id, deletedAt: null, status: "ACTIVE" },
      select: { householdId: true, userProfileId: true },
    });
    if (!membership) throw new NotFoundError("Integrante no encontrado.");
    if (membership.userProfileId === userProfile.id) throw new ForbiddenError("No podés quitarte a vos mismo.");

    // Requester must be an active member of the same household.
    const requesterMembership = await prisma.householdMember.findFirst({
      where: {
        householdId: membership.householdId,
        userProfileId: userProfile.id,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: { role: true },
    });
    if (!requesterMembership) throw new ForbiddenError("No tenés acceso a este hogar.");

    await prisma.householdMember.update({
      where: { id },
      data: { status: "REMOVED", deletedAt: new Date() },
    });

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}
