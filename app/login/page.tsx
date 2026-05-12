import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const profile = await prisma.userProfile.findUnique({
      where: { supabaseId: user.id },
      select: { onboardingCompletedAt: true },
    });
    redirect(profile?.onboardingCompletedAt ? "/dashboard" : "/onboarding");
  }

  return <LoginForm />;
}
