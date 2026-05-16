import { z } from "zod";

export const onboardingGoalSchema = z.enum([
  "entender-gastos",
  "ahorrar",
  "salir-excel",
  "organizar-deudas",
  "compartir-hogar",
]);

export const onboardingGoalAliases: Record<string, z.infer<typeof onboardingGoalSchema>> = {
  expenses: "entender-gastos",
  control: "entender-gastos",
  auto: "entender-gastos",
  save: "ahorrar",
  excel: "salir-excel",
  debts: "organizar-deudas",
  household: "compartir-hogar",
};

export const completeOnboardingSchema = z.object({
  goals: z.array(z.string()).max(8).optional().default([]),
});

export type OnboardingGoal = z.infer<typeof onboardingGoalSchema>;

export function normalizeOnboardingGoals(rawGoals: string[]): OnboardingGoal[] {
  const normalized = rawGoals
    .map((goal) => onboardingGoalAliases[goal] ?? goal)
    .filter((goal): goal is OnboardingGoal => onboardingGoalSchema.safeParse(goal).success);

  return Array.from(new Set(normalized));
}
