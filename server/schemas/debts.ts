import { CurrencyCode, DebtStatus, DebtType } from "@prisma/client";
import { z } from "zod";

const currencyValues = Object.values(CurrencyCode) as [CurrencyCode, ...CurrencyCode[]];
const debtTypeValues = Object.values(DebtType) as [DebtType, ...DebtType[]];
const debtStatusValues = Object.values(DebtStatus) as [DebtStatus, ...DebtStatus[]];

const moneySchema = z.coerce.number().finite().positive();

export const listDebtsSchema = z.object({
  householdId: z.string().min(1),
  status: z.enum(debtStatusValues).optional(),
});

export const createDebtSchema = z.object({
  householdId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  lender: z.string().trim().max(100).optional(),
  type: z.enum(debtTypeValues),
  currency: z.enum(currencyValues).default(CurrencyCode.ARS),
  originalAmount: moneySchema,
  outstandingAmount: moneySchema,
  minimumPayment: moneySchema.optional(),
  interestRate: z.coerce.number().finite().nonnegative().max(999).optional(),
  nextDueDate: z.coerce.date().optional(),
  dueDay: z.coerce.number().int().min(1).max(31).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateDebtSchema = createDebtSchema.partial().extend({
  householdId: z.string().min(1),
  lender: z.string().trim().max(100).nullable().optional(),
  minimumPayment: moneySchema.nullable().optional(),
  interestRate: z.coerce.number().finite().nonnegative().max(999).nullable().optional(),
  nextDueDate: z.coerce.date().nullable().optional(),
  dueDay: z.coerce.number().int().min(1).max(31).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(debtStatusValues).optional(),
});

export type ListDebtsInput = z.infer<typeof listDebtsSchema>;
export type CreateDebtInput = z.infer<typeof createDebtSchema>;
export type UpdateDebtInput = z.infer<typeof updateDebtSchema>;
