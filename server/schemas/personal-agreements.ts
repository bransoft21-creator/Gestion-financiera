import {
  AgreementCategory,
  AgreementDirection,
  AgreementEventType,
  AgreementInterestType,
  AgreementStatus,
  CurrencyCode,
} from "@prisma/client";
import { z } from "zod";
import { moneySchema, nullableMoneySchema } from "@/lib/money";

const currencyValues = Object.values(CurrencyCode) as [CurrencyCode, ...CurrencyCode[]];
const directionValues = Object.values(AgreementDirection) as [AgreementDirection, ...AgreementDirection[]];
const categoryValues = Object.values(AgreementCategory) as [AgreementCategory, ...AgreementCategory[]];
const statusValues = Object.values(AgreementStatus) as [AgreementStatus, ...AgreementStatus[]];
const eventTypeValues = Object.values(AgreementEventType) as [AgreementEventType, ...AgreementEventType[]];
const interestTypeValues = Object.values(AgreementInterestType) as [AgreementInterestType, ...AgreementInterestType[]];

export const listAgreementsSchema = z.object({
  householdId: z.string().min(1),
  status: z.enum(statusValues).optional(),
  direction: z.enum(directionValues).optional(),
  contactId: z.string().optional(),
});

export const createAgreementSchema = z.object({
  householdId: z.string().min(1),
  contactId: z.string().min(1, "Seleccioná una persona"),
  direction: z.enum(directionValues),
  currency: z.enum(currencyValues).default("ARS"),
  originalAmount: moneySchema(),
  description: z.string().max(300).optional().nullable(),
  category: z.enum(categoryValues).default("PERSONAL"),
  agreedReturnDate: z.string().datetime({ offset: true }).optional().nullable(),
  occurredAt: z.string().datetime({ offset: true }),
  hasInterest: z.boolean().default(false),
  interestType: z.enum(interestTypeValues).optional().nullable(),
  interestAmount: nullableMoneySchema({ allowZero: true }),
  interestRate: z.number().min(0).max(999).optional().nullable(),
  expectedInstallments: z.number().int().min(1).max(120).optional().nullable(),
  sourceAccountId: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const updateAgreementSchema = z.object({
  agreementId: z.string().min(1),
  description: z.string().max(300).optional().nullable(),
  agreedReturnDate: z.string().datetime({ offset: true }).optional().nullable(),
  expectedInstallments: z.number().int().min(1).max(120).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  category: z.enum(categoryValues).optional(),
});

export const closeAgreementSchema = z.object({
  agreementId: z.string().min(1),
  closeType: z.enum(["CLOSED", "FORGIVEN", "CANCELED"]),
  notes: z.string().max(300).optional().nullable(),
});

export const createAgreementEventSchema = z.object({
  agreementId: z.string().min(1),
  type: z.enum(eventTypeValues),
  amount: nullableMoneySchema({ allowZero: true }),
  currency: z.enum(currencyValues).optional().nullable(),
  description: z.string().max(300).optional().nullable(),
  transactionId: z.string().optional().nullable(),
  occurredAt: z.string().datetime({ offset: true }),
  // Para pagos que quieran linkear a una cuenta: creamos Transaction y la linkeamos
  accountId: z.string().optional().nullable(),
  householdId: z.string().min(1),
});

export type ListAgreementsInput = z.infer<typeof listAgreementsSchema>;
export type CreateAgreementInput = z.infer<typeof createAgreementSchema>;
export type UpdateAgreementInput = z.infer<typeof updateAgreementSchema>;
export type CloseAgreementInput = z.infer<typeof closeAgreementSchema>;
export type CreateAgreementEventInput = z.infer<typeof createAgreementEventSchema>;
