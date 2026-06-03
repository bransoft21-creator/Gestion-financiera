import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/server/api/http";
import { getCurrentUser } from "@/server/auth/current-user";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { userProfile } = await getCurrentUser();
    const onlyPersonal = request.nextUrl.searchParams.get("onlyPersonal") === "1";

    const memberships = await prisma.householdMember.findMany({
      where: {
        userProfileId: userProfile.id,
        status: "ACTIVE",
        deletedAt: null,
        household: {
          deletedAt: null,
          ...(onlyPersonal ? { kind: "PERSONAL", createdById: userProfile.id } : {}),
        },
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
      orderBy: [{ type: "asc" }, { name: "asc" }, { currentBalance: "desc" }],
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

    // Deduplicate by name+currency keeping the account with the highest balance.
    const seen = new Set<string>();
    const deduped = accounts.filter((a) => {
      const key = `${a.name}__${a.currency}__${a.householdId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return ok(
      deduped.map((a) => ({
        ...a,
        currentBalance: Number(a.currentBalance),
        householdName: householdMap.get(a.householdId)?.name,
        householdKind: householdMap.get(a.householdId)?.kind,
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
