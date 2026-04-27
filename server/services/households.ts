import { HouseholdMemberStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { ForbiddenError } from "../api/errors";

export async function assertHouseholdAccess(userProfileId: string, householdId: string) {
  const membership = await prisma.householdMember.findFirst({
    where: {
      householdId,
      userProfileId,
      status: HouseholdMemberStatus.ACTIVE,
      deletedAt: null,
      household: {
        deletedAt: null,
      },
    },
  });

  if (!membership) {
    throw new ForbiddenError();
  }

  return membership;
}
