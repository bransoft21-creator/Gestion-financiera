import { CardPaymentKind } from "@prisma/client";
import { z } from "zod";
import { moneySchema } from "@/lib/money";
import { transactionDateFromInput } from "@/lib/dates";

const cardPaymentKindValues = Object.values(CardPaymentKind) as [CardPaymentKind, ...CardPaymentKind[]];

export const listCreditCardsSchema = z.object({
  householdId: z.string().min(1),
});

export const payCardStatementSchema = z.object({
  householdId: z.string().min(1),
  sourceAccountId: z.string().min(1),
  amount: moneySchema(),
  kind: z.enum(cardPaymentKindValues).default(CardPaymentKind.CUSTOM),
  paidAt: z.preprocess(transactionDateFromInput, z.date()).optional(),
});

export type ListCreditCardsInput = z.infer<typeof listCreditCardsSchema>;
export type PayCardStatementInput = z.infer<typeof payCardStatementSchema>;
