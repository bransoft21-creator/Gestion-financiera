import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAiEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { HouseholdKind, HouseholdMemberStatus } from "@prisma/client";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userProfile = await prisma.userProfile.findUnique({
    where: { supabaseId: user.id },
    select: { id: true, currency: true },
  });

  const household = userProfile
    ? await prisma.householdMember.findFirst({
        where: {
          userProfileId: userProfile.id,
          status: HouseholdMemberStatus.ACTIVE,
          deletedAt: null,
          household: { kind: HouseholdKind.PERSONAL, deletedAt: null },
        },
        select: { household: { select: { defaultCurrency: true } } },
      })
    : null;

  return (
    <SettingsClient
      primaryCurrency={household?.household.defaultCurrency ?? userProfile?.currency ?? "ARS"}
      isAiEnabled={user.email ? isAiEnabled(user.email) : false}
    />
  );
}
