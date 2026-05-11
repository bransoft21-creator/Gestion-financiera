import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    select: { onboardingCompletedAt: true },
  });

  if (!profile || !profile.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  return (
    <AppShell userEmail={user.email} userName={getDisplayName(user.user_metadata)}>{children}</AppShell>
  );
}

function getDisplayName(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.full_name ?? metadata?.name;
  return typeof value === "string" ? value : null;
}
