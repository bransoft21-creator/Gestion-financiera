import { AccountType, CurrencyCode } from "@prisma/client";
import { z } from "zod";
import { moneySchema, nullableMoneySchema } from "@/lib/money";

const accountTypeValues = Object.values(AccountType) as [AccountType, ...AccountType[]];
const currencyValues = Object.values(CurrencyCode) as [CurrencyCode, ...CurrencyCode[]];

export const listAccountsSchema = z.object({
  householdId: z.string().min(1),
  includeArchived: z.coerce.boolean().default(false),
});

export const createAccountSchema = z.object({
  householdId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  type: z.enum(accountTypeValues),
  currency: z.enum(currencyValues).default(CurrencyCode.ARS),
  openingBalance: moneySchema({ allowNegative: true, allowZero: true }).default(0),
  creditLimit: nullableMoneySchema(),
});

export const updateAccountSchema = createAccountSchema.partial().extend({
  householdId: z.string().min(1),
  creditLimit: nullableMoneySchema(),
  isArchived: z.boolean().optional(),
});

export type ListAccountsInput = z.infer<typeof listAccountsSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
