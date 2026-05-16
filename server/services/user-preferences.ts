import { CurrencyCode, HouseholdKind, HouseholdMemberStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { UpdatePreferencesInput } from "../schemas/user-preferences";
import { normalizeOnboardingGoals } from "../schemas/onboarding";

export async function getUserPreferences(userProfileId: string) {
  const profile = await prisma.userProfile.findUniqueOrThrow({
    where: { id: userProfileId },
    select: { theme: true, textSize: true, language: true, currency: true, onboardingGoals: true },
  });

  return {
    theme: profile.theme as "system" | "dark" | "light",
    textSize: profile.textSize as "normal" | "large",
    language: profile.language as "es" | "en",
    primaryCurrency: profile.currency as "ARS" | "USD",
    onboardingGoals: normalizeOnboardingGoals(profile.onboardingGoals),
  };
}

export async function updateUserPreferences(
  userProfileId: string,
  input: UpdatePreferencesInput,
) {
  const updates: Record<string, unknown> = {};

  if (input.theme !== undefined) updates.theme = input.theme;
  if (input.textSize !== undefined) updates.textSize = input.textSize;
  if (input.language !== undefined) updates.language = input.language;
  if (input.onboardingGoals !== undefined) updates.onboardingGoals = normalizeOnboardingGoals(input.onboardingGoals);
  if (input.primaryCurrency !== undefined) {
    updates.currency = input.primaryCurrency as CurrencyCode;
  }

  const profile = await prisma.userProfile.update({
    where: { id: userProfileId },
    data: updates,
    select: { theme: true, textSize: true, language: true, currency: true, onboardingGoals: true },
  });

  if (input.primaryCurrency !== undefined) {
    await prisma.householdMember.findFirst({
      where: {
        userProfileId,
        status: HouseholdMemberStatus.ACTIVE,
        deletedAt: null,
        household: { kind: HouseholdKind.PERSONAL, deletedAt: null },
      },
      select: { householdId: true },
    }).then((membership) => {
      if (membership) {
        return prisma.household.update({
          where: { id: membership.householdId },
          data: { defaultCurrency: input.primaryCurrency as CurrencyCode },
        });
      }
    });
  }

  return {
    theme: profile.theme as "system" | "dark" | "light",
    textSize: profile.textSize as "normal" | "large",
    language: profile.language as "es" | "en",
    primaryCurrency: profile.currency as "ARS" | "USD",
    onboardingGoals: normalizeOnboardingGoals(profile.onboardingGoals),
  };
}
