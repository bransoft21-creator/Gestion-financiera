import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { safeUserId } from "@/lib/observability/user";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EMPTY_NAVIGATION_AWARENESS } from "@/lib/navigation-awareness";
import { getNavigationAwareness } from "@/server/services/navigation-awareness";

export default async function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await prisma.userProfile.findUnique({
    where: { supabaseId: user.id },
    select: { id: true, onboardingCompletedAt: true },
  });

  if (!profile || !profile.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  const awareness = await getNavigationAwareness(profile.id).catch(() => EMPTY_NAVIGATION_AWARENESS);

  return (
    <AppShell
      userId={safeUserId(profile.id)}
      userEmail={user.email}
      userName={getDisplayName(user.user_metadata)}
      awareness={awareness}
    >
      {children}
    </AppShell>
  );
}

function getDisplayName(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.full_name ?? metadata?.name;
  return typeof value === "string" ? value : null;
}
