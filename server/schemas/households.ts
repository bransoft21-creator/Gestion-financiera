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

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type CreateHouseholdInviteInput = z.infer<typeof createHouseholdInviteSchema>;
