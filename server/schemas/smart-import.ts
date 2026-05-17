import {
  CurrencyCode,
  ExpenseType,
  PaymentMethod,
  TransactionOrigin,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import { z } from "zod";
import { transactionDateFromInput } from "@/lib/dates";
import { moneySchema } from "@/lib/money";

const currencyValues = Object.values(CurrencyCode) as [CurrencyCode, ...CurrencyCode[]];
const transactionStatusValues = Object.values(TransactionStatus) as [TransactionStatus, ...TransactionStatus[]];
const transactionTypeValues = Object.values(TransactionType) as [TransactionType, ...TransactionType[]];
const expenseTypeValues = Object.values(ExpenseType) as [ExpenseType, ...ExpenseType[]];
const transactionOriginValues = Object.values(TransactionOrigin) as [TransactionOrigin, ...TransactionOrigin[]];
const paymentMethodValues = Object.values(PaymentMethod) as [PaymentMethod, ...PaymentMethod[]];

const optionalEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.enum(values).optional(),
  );

const optionalPositiveInt = z.preprocess(
  (v) => (v === "" || v === null || v === 0 || v === undefined ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

export const importCandidateSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  type: z.enum(transactionTypeValues),
  currency: z.enum(currencyValues).default(CurrencyCode.ARS),
  amount: moneySchema(),
  description: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
  expenseType: optionalEnum(expenseTypeValues),
  origin: z.enum(transactionOriginValues).default(TransactionOrigin.CARD_SUMMARY),
  paymentMethod: optionalEnum(paymentMethodValues),
  isInstallment: z.boolean().default(false),
  installmentNumber: optionalPositiveInt,
  totalInstallments: optionalPositiveInt,
  occurredAt: z.preprocess(transactionDateFromInput, z.date()),
  status: z.enum(transactionStatusValues).default(TransactionStatus.CONFIRMED),
});

export const importCandidatesSchema = z.object({
  householdId: z.string().min(1),
  candidates: z
    .array(importCandidateSchema)
    .min(1, "Seleccioná al menos una transacción.")
    .max(500, "Podés importar hasta 500 transacciones a la vez."),
});

export type ImportCandidateInput = z.infer<typeof importCandidateSchema>;
export type ImportCandidatesInput = z.infer<typeof importCandidatesSchema>;
