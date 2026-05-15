import type { ExpenseType, PaymentMethod, TransactionOrigin, TransactionType } from "./types";

export const transactionTypeLabels: Record<TransactionType, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  TRANSFER: "Transferencia",
  ADJUSTMENT: "Ajuste",
  DEBT_PAYMENT: "Pago de deuda",
  GOAL_CONTRIBUTION: "Aporte a meta",
  INVESTMENT: "Inversión",
};

export const transactionTypes = Object.keys(transactionTypeLabels) as TransactionType[];
export const supportedFormTransactionTypes = ["INCOME", "EXPENSE", "TRANSFER", "ADJUSTMENT"] as const;

export const expenseTypeLabels: Record<ExpenseType, string> = {
  FIXED: "Fijo",
  VARIABLE: "Variable",
  EXTRAORDINARY: "Extraordinario",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  DEBIT: "Débito",
  CREDIT: "Crédito",
  TRANSFER: "Transferencia",
};

export const transactionOriginLabels: Record<TransactionOrigin, string> = {
  MANUAL: "Manual",
  CARD_SUMMARY: "Resumen tarjeta",
  BANK: "Banco",
  MERCADO_PAGO: "Mercado Pago",
};

export const transactionSelectClass =
  "v2-focus-ring h-11 w-full min-w-0 max-w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-base md:text-sm text-white outline-none transition hover:bg-white/[0.07]";

export const compactSelectClass =
  "v2-focus-ring h-9 w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-base md:text-xs text-white outline-none transition hover:bg-white/[0.07]";
