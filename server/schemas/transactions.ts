import { CurrencyCode, ExpenseType, PaymentMethod, TransactionOrigin, TransactionStatus, TransactionType } from "@prisma/client";
import { z } from "zod";
import { argentinaDayStartFromInput, transactionDateFromInput } from "@/lib/dates";
import { moneySchema } from "@/lib/money";

const currencyValues = Object.values(CurrencyCode) as [CurrencyCode, ...CurrencyCode[]];
const transactionStatusValues = Object.values(TransactionStatus) as [TransactionStatus, ...TransactionStatus[]];
const transactionTypeValues = Object.values(TransactionType) as [TransactionType, ...TransactionType[]];
const expenseTypeValues = Object.values(ExpenseType) as [ExpenseType, ...ExpenseType[]];
const transactionOriginValues = Object.values(TransactionOrigin) as [TransactionOrigin, ...TransactionOrigin[]];
const paymentMethodValues = Object.values(PaymentMethod) as [PaymentMethod, ...PaymentMethod[]];
const transactionDateSchema = z.preprocess(transactionDateFromInput, z.date());
const filterDateSchema = z.preprocess(argentinaDayStartFromInput, z.date());
const optionalEnumSchema = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.enum(values).optional(),
  );
const optionalPositiveIntSchema = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.coerce.number().int().positive().optional(),
);

const createTransactionBaseSchema = z.object({
  householdId: z.string().min(1),
  accountId: z.string().min(1),
  transferAccountId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  goalId: z.string().min(1).optional(),
  debtId: z.string().min(1).optional(),
  investmentTransactionId: z.string().min(1).optional(),
  clientRequestId: z.string().trim().min(16).max(80).optional(),
  type: z.enum(transactionTypeValues),
  status: z.enum(transactionStatusValues).default(TransactionStatus.CONFIRMED),
  currency: z.enum(currencyValues).default(CurrencyCode.ARS),
  amount: moneySchema(),
  transferAmount: moneySchema().optional(),
  description: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
  expenseType: optionalEnumSchema(expenseTypeValues),
  origin: z.enum(transactionOriginValues).default(TransactionOrigin.MANUAL),
  paymentMethod: optionalEnumSchema(paymentMethodValues),
  isInstallment: z.boolean().default(false),
  installmentNumber: optionalPositiveIntSchema,
  totalInstallments: optionalPositiveIntSchema,
  isRecurring: z.boolean().default(false),
  occurredAt: transactionDateSchema,
  sharedHouseholdId: z.string().min(1).optional(),
});

export const createTransactionSchema = createTransactionBaseSchema.superRefine((data, ctx) => {
  if (data.type === TransactionType.TRANSFER && !data.transferAccountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "transferAccountId es requerido para transferencias",
      path: ["transferAccountId"],
    });
  }
  if (data.transferAccountId && data.accountId === data.transferAccountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La cuenta destino no puede ser igual a la cuenta origen",
      path: ["transferAccountId"],
    });
  }
  if (data.type === TransactionType.DEBT_PAYMENT && !data.debtId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "debtId es requerido para pagos de deuda",
      path: ["debtId"],
    });
  }
  if (data.type === TransactionType.GOAL_CONTRIBUTION && !data.goalId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "goalId es requerido para contribuciones a meta",
      path: ["goalId"],
    });
  }
  if (data.sharedHouseholdId && data.type !== TransactionType.EXPENSE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Solo los gastos pueden compartirse con un hogar.",
      path: ["sharedHouseholdId"],
    });
  }
});

export const updateTransactionSchema = createTransactionBaseSchema
  .partial()
  .extend({
    householdId: z.string().min(1),
    transferAccountId: z.string().min(1).nullable().optional(),
    categoryId: z.string().min(1).nullable().optional(),
    goalId: z.string().min(1).nullable().optional(),
    debtId: z.string().min(1).nullable().optional(),
    investmentTransactionId: z.string().min(1).nullable().optional(),
    expenseType: z.enum(expenseTypeValues).nullable().optional(),
    paymentMethod: z.enum(paymentMethodValues).nullable().optional(),
    installmentNumber: z.coerce.number().int().positive().nullable().optional(),
    totalInstallments: z.coerce.number().int().positive().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.transferAccountId &&
      data.accountId &&
      data.accountId === data.transferAccountId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La cuenta destino no puede ser igual a la cuenta origen",
        path: ["transferAccountId"],
      });
    }
  });

export const listTransactionsSchema = z
  .object({
    householdId: z.string().min(1),
    accountId: z.string().min(1).optional(),
    categoryId: z.string().min(1).optional(),
    type: z.enum(transactionTypeValues).optional(),
    status: z.enum(transactionStatusValues).optional(),
    from: filterDateSchema.optional(),
    to: filterDateSchema.optional(),
    search: z.string().trim().max(100).optional(),
    limit: z.coerce.number().int().positive().max(100).default(50),
    cursor: z.string().min(1).optional(),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: "La fecha 'from' debe ser anterior o igual a 'to'",
    path: ["from"],
  });

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type ListTransactionsInput = z.infer<typeof listTransactionsSchema>;
