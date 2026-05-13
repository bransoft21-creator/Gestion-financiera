import { z } from "zod";

export const createHouseholdSchema = z.object({
  name: z.string().trim().min(2, "Poné un nombre para el hogar.").max(80),
  avatar: z.string().trim().max(8).optional().nullable(),
});

export const createHouseholdInviteSchema = z.object({
  householdId: z.string().min(1),
  email: z.string().trim().toLowerCase().email("Ingresá un email válido."),
});

export const householdBalanceSchema = z.object({
  householdId: z.string().min(1),
});

export const createSettlementSchema = z.object({
  householdId: z.string().min(1),
  amount: z.number().positive("El monto debe ser positivo."),
  notes: z.string().trim().max(200).optional().nullable(),
});

export const listSettlementsSchema = z.object({
  householdId: z.string().min(1),
});

export const listRecurringPaymentsSchema = z.object({
  householdId: z.string().min(1),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export const createRecurringPaymentSchema = z.object({
  householdId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  estimatedAmount: z.number().positive(),
  dueDay: z.number().int().min(1).max(31),
  currency: z.enum(["ARS", "USD"]).default("ARS"),
  categoryId: z.string().min(1).optional().nullable(),
  splitMode: z.enum(["EQUAL", "PERCENTAGE", "CUSTOM_AMOUNT"]).default("EQUAL"),
  participants: z.array(z.object({
    userId: z.string().min(1),
    value: z.number().min(0),
  })).optional(),
});

export const updateRecurringPaymentSchema = createRecurringPaymentSchema
  .omit({ householdId: true })
  .partial()
  .extend({ householdId: z.string().min(1) });

export const markRecurringPaymentAsPaidSchema = z.object({
  householdId: z.string().min(1),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  paidByUserId: z.string().min(1),
  accountId: z.string().min(1),
  finalAmount: z.number().positive().optional(),
});

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type CreateHouseholdInviteInput = z.infer<typeof createHouseholdInviteSchema>;
export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
export type ListRecurringPaymentsInput = z.infer<typeof listRecurringPaymentsSchema>;
export type CreateRecurringPaymentInput = z.infer<typeof createRecurringPaymentSchema>;
export type UpdateRecurringPaymentInput = z.infer<typeof updateRecurringPaymentSchema>;
export type MarkRecurringPaymentAsPaidInput = z.infer<typeof markRecurringPaymentAsPaidSchema>;
