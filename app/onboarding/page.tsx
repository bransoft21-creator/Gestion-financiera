import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { UnauthorizedError } from "@/server/api/errors";
import { OnboardingClient } from "./onboarding-client";

export default async function OnboardingPage() {
  let userProfile;

  try {
    const result = await getCurrentUser();
    userProfile = result.userProfile;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/login");
    }
    throw error;
  }

  if (userProfile.onboardingCompletedAt) {
    redirect("/dashboard");
  }

  return <OnboardingClient />;
}
