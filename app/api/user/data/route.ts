import { handleApiError, ok } from "../../../../server/api/http";
import { getCurrentUser } from "../../../../server/auth/current-user";
import { prisma } from "../../../../lib/prisma";
import { deleteHouseholdFinancialData } from "../../../../server/services/user-data";
import { HouseholdKind, HouseholdMemberStatus } from "@prisma/client";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    const { userProfile } = await getCurrentUser();

    const membership = await prisma.householdMember.findFirst({
      where: {
        userProfileId: userProfile.id,
        status: HouseholdMemberStatus.ACTIVE,
        deletedAt: null,
        household: { kind: HouseholdKind.PERSONAL, deletedAt: null },
      },
      select: { householdId: true },
    });

    if (!membership) {
      return ok({ deleted: true });
    }

    await deleteHouseholdFinancialData(membership.householdId, userProfile.id);

    // Remove user from any shared households (keeps household + other members intact)
    await prisma.householdMember.updateMany({
      where: {
        userProfileId: userProfile.id,
        status: HouseholdMemberStatus.ACTIVE,
        deletedAt: null,
        household: { kind: HouseholdKind.HOUSEHOLD, deletedAt: null },
      },
      data: {
        status: HouseholdMemberStatus.REMOVED,
        deletedAt: new Date(),
      },
    });

    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
