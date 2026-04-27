import { AccountType, CurrencyCode, HouseholdRole, HouseholdMemberStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { UnauthorizedError } from "../api/errors";

export type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    throw new UnauthorizedError();
  }

  const fullName = getFullName(user.user_metadata);
  const avatarUrl = getAvatarUrl(user.user_metadata);

  let userProfile = await prisma.userProfile.findUnique({
    where: { supabaseId: user.id },
  });

  if (!userProfile) {
    userProfile = await prisma.userProfile.create({
      data: {
        supabaseId: user.id,
        email: user.email,
        fullName,
        avatarUrl,
        currency: CurrencyCode.ARS,
      },
    });
  } else if (
    userProfile.email !== user.email ||
    userProfile.fullName !== fullName ||
    userProfile.avatarUrl !== avatarUrl ||
    userProfile.deletedAt !== null
  ) {
    userProfile = await prisma.userProfile.update({
      where: { supabaseId: user.id },
      data: { email: user.email, fullName, avatarUrl, deletedAt: null },
    });
  }

  const activeMembership = await prisma.householdMember.findFirst({
    where: {
      userProfileId: userProfile.id,
      status: HouseholdMemberStatus.ACTIVE,
      deletedAt: null,
      household: {
        deletedAt: null,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!activeMembership) {
    await prisma.household.create({
      data: {
        name: "Mi hogar",
        defaultCurrency: userProfile.currency,
        createdById: userProfile.id,
        members: {
          create: {
            userProfileId: userProfile.id,
            role: HouseholdRole.OWNER,
            status: HouseholdMemberStatus.ACTIVE,
            joinedAt: new Date(),
          },
        },
        accounts: {
          create: {
            createdById: userProfile.id,
            name: "Efectivo",
            type: AccountType.CASH,
            currency: CurrencyCode.ARS,
            openingBalance: 0,
            currentBalance: 0,
          },
        },
      },
    });
  }

  return {
    supabaseUser: user,
    userProfile,
  };
}

function getFullName(metadata: Record<string, unknown> | null | undefined) {
  return getStringMetadata(metadata, "full_name") ?? getStringMetadata(metadata, "name");
}

function getAvatarUrl(metadata: Record<string, unknown> | null | undefined) {
  return getStringMetadata(metadata, "avatar_url") ?? getStringMetadata(metadata, "picture");
}

function getStringMetadata(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];

  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
