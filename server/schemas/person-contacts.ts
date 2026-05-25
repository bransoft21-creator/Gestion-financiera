import { z } from "zod";

export const listContactsSchema = z.object({
  householdId: z.string().min(1),
  search: z.string().optional(),
});

export const createContactSchema = z.object({
  householdId: z.string().min(1),
  name: z.string().min(1, "El nombre es requerido").max(100),
  alias: z.string().max(50).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  notes: z.string().max(500).optional().nullable(),
  avatarColor: z.string().optional().nullable(),
});

export const updateContactSchema = createContactSchema.omit({ householdId: true }).partial().extend({
  contactId: z.string().min(1),
});

export type ListContactsInput = z.infer<typeof listContactsSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
