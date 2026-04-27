import { CurrencyCode, RecurrenceFrequency } from "@prisma/client";
import { z } from "zod";

const currencyValues = Object.values(CurrencyCode) as [CurrencyCode, ...CurrencyCode[]];
const frequencyValues = Object.values(RecurrenceFrequency) as [
  RecurrenceFrequency,
  ...RecurrenceFrequency[],
];

export const listRecurringExpensesSchema = z.object({
  householdId: z.string().min(1),
  isActive: z.coerce.boolean().optional(),
});

export const createRecurringExpenseSchema = z.object({
  householdId: z.string().min(1),
  accountId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  name: z.string().trim().min(2).max(100),
  currency: z.enum(currencyValues).default(CurrencyCode.ARS),
  amount: z.coerce.number().finite().positive(),
  frequency: z.enum(frequencyValues),
  nextDueDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateRecurringExpenseSchema = createRecurringExpenseSchema.partial().extend({
  householdId: z.string().min(1),
  accountId: z.string().min(1).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const toggleRecurringExpenseSchema = z.object({
  householdId: z.string().min(1),
  isActive: z.boolean(),
});

export type ListRecurringExpensesInput = z.infer<typeof listRecurringExpensesSchema>;
export type CreateRecurringExpenseInput = z.infer<typeof createRecurringExpenseSchema>;
export type UpdateRecurringExpenseInput = z.infer<typeof updateRecurringExpenseSchema>;
export type ToggleRecurringExpenseInput = z.infer<typeof toggleRecurringExpenseSchema>;
