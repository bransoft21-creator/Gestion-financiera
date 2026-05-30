"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateFinancialData } from "@/lib/invalidate";
import { queryKeys } from "@/lib/query-keys";

export type CardStatementStatus =
  | "OPEN"
  | "CLOSED_PENDING_PAYMENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "ARCHIVED";

export type CardPaymentKind = "MINIMUM" | "FULL" | "PARTIAL" | "CUSTOM";
export type CardPressure = "none" | "low" | "medium" | "high" | "overdue";

export type CardStatementMovementItem = {
  id: string;
  transactionId: string | null;
  description: string | null;
  currency: "ARS" | "USD";
  amount: number;
  occurredAt: string;
  category: { name: string; icon: string | null } | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
  isTax: boolean;
};

export type CardStatementItem = {
  id: string;
  creditCardId: string;
  householdId: string;
  currency: "ARS" | "USD";
  periodYear: number;
  periodMonth: number;
  cycleStartDate: string;
  cycleEndDate: string;
  closeDate: string | null;
  dueDate: string | null;
  status: CardStatementStatus;
  totalAmount: number;
  pendingAmount: number;
  minimumPayment: number | null;
  paidAmount: number;
  movementTotal: number;
  reconciliationDelta: number;
  isReconciled: boolean;
  importedAt: string | null;
  movements: CardStatementMovementItem[];
  transactionCount: number;
  paymentCount: number;
};

export type CreditCardItem = {
  id: string;
  householdId: string;
  accountId: string | null;
  name: string;
  issuer: string | null;
  network: string | null;
  last4: string | null;
  closeDay: number | null;
  dueDay: number | null;
  currency: "ARS" | "USD";
  creditLimit: number | null;
  usedAmount: number;
  utilizationPercent: number | null;
  isActive: boolean;
  pressure: CardPressure;
  activeStatement: CardStatementItem | null;
  pendingStatements: CardStatementItem[];
  currentStatement: CardStatementItem | null;
  history: CardStatementItem[];
  statements: CardStatementItem[];
};

async function fetchCreditCards(householdId: string): Promise<CreditCardItem[]> {
  const response = await fetch(`/api/credit-cards?${new URLSearchParams({ householdId })}`);
  const payload = (await response.json()) as {
    data?: { cards: CreditCardItem[] };
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar las tarjetas.");
  return payload.data?.cards ?? [];
}

export function useCreditCards(householdId: string) {
  return useQuery({
    queryKey: queryKeys.creditCards.list(householdId),
    queryFn: () => fetchCreditCards(householdId),
    staleTime: 30_000,
  });
}

export function usePayCardStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      householdId: string;
      statementId: string;
      sourceAccountId: string;
      amount: number;
      kind: CardPaymentKind;
      paidAt: string;
    }) => {
      const response = await fetch(`/api/card-statements/${input.statementId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: input.householdId,
          sourceAccountId: input.sourceAccountId,
          amount: input.amount,
          kind: input.kind,
          paidAt: input.paidAt,
        }),
      });
      const payload = (await response.json()) as { error?: string; fieldErrors?: Record<string, string> };
      if (!response.ok) {
        const err = new Error(payload.error ?? "No se pudo registrar el pago de tarjeta.");
        (err as Error & { fieldErrors?: Record<string, string> }).fieldErrors = payload.fieldErrors;
        throw err;
      }
      return payload;
    },
    onSuccess: () => {
      toast.success("Pago de tarjeta registrado.");
      invalidateFinancialData(queryClient, "transactionChanged");
    },
  });
}
