import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { isSmartImportEnabled } from "@/lib/feature-flags";
import { OnboardingClient } from "./onboarding-client";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ replay?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { userProfile } = await getCurrentUser();
  const params = await searchParams;
  const isReplay = params.replay === "1";

  // En modo replay un usuario existente puede volver a ver el tutorial sin gates
  if (userProfile.onboardingCompletedAt && !isReplay) {
    redirect("/dashboard");
  }

  return (
    <OnboardingClient
      canSmartImport={isSmartImportEnabled(userProfile.email)}
      replayMode={isReplay}
    />
  );
}
