import { CurrencyCode, GoalStatus } from "@prisma/client";
import { z } from "zod";

const currencyValues = Object.values(CurrencyCode) as [CurrencyCode, ...CurrencyCode[]];
const goalStatusValues = Object.values(GoalStatus) as [GoalStatus, ...GoalStatus[]];
const moneySchema = z.coerce.number().finite().nonnegative();

export const listGoalsSchema = z.object({
  householdId: z.string().min(1),
  status: z.enum(goalStatusValues).optional(),
});

export const createGoalSchema = z.object({
  householdId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  currency: z.enum(currencyValues).default(CurrencyCode.ARS),
  targetAmount: z.coerce.number().finite().positive(),
  currentAmount: moneySchema.default(0),
  requiredMonthlyAmount: moneySchema.optional(),
  targetDate: z.coerce.date().optional(),
  status: z.enum(goalStatusValues).default(GoalStatus.ACTIVE),
  notes: z.string().trim().max(1000).optional(),
});

export const updateGoalSchema = createGoalSchema.partial().extend({
  householdId: z.string().min(1),
  requiredMonthlyAmount: moneySchema.nullable().optional(),
  targetDate: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type ListGoalsInput = z.infer<typeof listGoalsSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
