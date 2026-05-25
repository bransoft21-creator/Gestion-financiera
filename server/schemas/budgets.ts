import { CurrencyCode } from "@prisma/client";
import { z } from "zod";
import { moneySchema, optionalMoneySchema } from "@/lib/money";

const currencyValues = Object.values(CurrencyCode) as [CurrencyCode, ...CurrencyCode[]];

export const budgetPeriodSchema = z.object({
  householdId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export const createBudgetSchema = z.object({
  householdId: z.string().min(1),
  categoryId: z.string().min(1),
  currency: z.enum(currencyValues).default(CurrencyCode.ARS),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  plannedAmount: moneySchema(),
  alertThreshold: z.coerce.number().finite().positive().max(100).optional(),
});

export const updateBudgetSchema = createBudgetSchema.partial().extend({
  householdId: z.string().min(1),
  plannedAmount: optionalMoneySchema(),
  alertThreshold: z.coerce.number().finite().positive().max(100).nullable().optional(),
});

export type BudgetPeriodInput = z.infer<typeof budgetPeriodSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
