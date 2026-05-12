import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { isAiEnabled } from "@/lib/feature-flags";
import { OnboardingClient } from "./onboarding-client";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Creates profile + household + default accounts/categories if this is the first visit
  const { userProfile } = await getCurrentUser();

  if (userProfile.onboardingCompletedAt) {
    redirect("/dashboard");
  }

  return <OnboardingClient canSmartImport={isAiEnabled(userProfile.email)} />;
}
