import { z } from "zod";
import { onboardingGoalSchema } from "./onboarding";

export const updatePreferencesSchema = z.object({
  theme: z.enum(["system", "dark", "light"]).optional(),
  textSize: z.enum(["normal", "large"]).optional(),
  language: z.enum(["es", "en"]).optional(),
  primaryCurrency: z.enum(["ARS", "USD"]).optional(),
  onboardingGoals: z.array(onboardingGoalSchema).max(8).optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
