import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; mode?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error, next, mode } = await searchParams;
  const nextPath = getSafeNextPath(next);
  const initialMode = mode === "forgot" ? "forgot" : "login";

  if (user) {
    const profile = await prisma.userProfile.findUnique({
      where: { supabaseId: user.id },
      select: { onboardingCompletedAt: true },
    });
    redirect(nextPath ?? (profile?.onboardingCompletedAt ? "/dashboard" : "/onboarding"));
  }

  return <LoginForm initialError={error} initialMode={initialMode} nextPath={nextPath} />;
}

function getSafeNextPath(value: string | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
