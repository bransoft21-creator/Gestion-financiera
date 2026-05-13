import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { userProfile } = await getCurrentUser();

    const memberships = await prisma.householdMember.findMany({
      where: {
        userProfileId: userProfile.id,
        status: "ACTIVE",
        deletedAt: null,
        household: { deletedAt: null },
      },
      select: {
        householdId: true,
        household: { select: { name: true, kind: true } },
      },
    });

    const householdIds = memberships.map((m) => m.householdId);

    const accounts = await prisma.account.findMany({
      where: {
        householdId: { in: householdIds },
        isArchived: false,
        deletedAt: null,
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        householdId: true,
        name: true,
        type: true,
        currency: true,
        currentBalance: true,
      },
    });

    const householdMap = new Map(memberships.map((m) => [m.householdId, m.household]));

    return ok(
      accounts.map((a) => ({
        ...a,
        currentBalance: Number(a.currentBalance),
        householdName: householdMap.get(a.householdId)?.name,
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
