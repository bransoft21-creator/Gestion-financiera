"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { invalidateFinancialData } from "@/lib/invalidate";

export type DebtItem = {
  id: string;
  name: string;
  lender: string | null;
  type: "LOAN" | "CREDIT_CARD" | "PERSONAL" | "INSTALLMENT" | "OTHER";
  status: "ACTIVE" | "PAID" | "PAUSED" | "DEFAULTED" | "CANCELED";
  currency: "ARS" | "USD";
  accountId: string | null;
  originalAmount: number;
  outstandingAmount: number;
  minimumPayment: number | null;
  interestRate: number | null;
  nextDueDate: string | null;
  dueDay: number | null;
  notes: string | null;
  paidPercent: number;
};

async function fetchDebts(householdId: string, statusFilter?: string) {
  const params = new URLSearchParams({ householdId });
  if (statusFilter) params.set("status", statusFilter);
  const response = await fetch(`/api/debts?${params}`);
  const payload = (await response.json()) as {
    data?: { debts: DebtItem[]; totalOutstanding: number };
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar las deudas.");
  return payload.data ?? { debts: [], totalOutstanding: 0 };
}

export function useDebts(householdId: string, statusFilter?: string) {
  return useQuery({
    queryKey: queryKeys.debts.list(householdId, statusFilter),
    queryFn: () => fetchDebts(householdId, statusFilter),
    staleTime: 30_000,
  });
}

type SaveDebtInput = {
  householdId: string;
  name: string;
  accountId?: string | null;
  lender?: string | null;
  type: string;
  status: string;
  currency: "ARS" | "USD";
  originalAmount: number;
  outstandingAmount: number;
  minimumPayment?: number | null;
  interestRate?: number | null;
  nextDueDate?: string | null;
  dueDay?: number | null;
  notes?: string | null;
};

export function useCreateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveDebtInput) => {
      const response = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as { error?: string; fieldErrors?: Record<string, string> };
      if (!response.ok) {
        const err = new Error(payload.error ?? "No se pudo crear la deuda.");
        (err as Error & { fieldErrors?: Record<string, string> }).fieldErrors = payload.fieldErrors;
        throw err;
      }
      return payload;
    },
    onSuccess: () => {
      toast.success("Deuda creada.");
      invalidateFinancialData(queryClient, "debtChanged");
    },
  });
}

export function useUpdateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ debtId, ...input }: SaveDebtInput & { debtId: string }) => {
      const response = await fetch(`/api/debts/${debtId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as { error?: string; fieldErrors?: Record<string, string> };
      if (!response.ok) {
        const err = new Error(payload.error ?? "No se pudo actualizar la deuda.");
        (err as Error & { fieldErrors?: Record<string, string> }).fieldErrors = payload.fieldErrors;
        throw err;
      }
      return payload;
    },
    onSuccess: () => {
      toast.success("Deuda actualizada.");
      invalidateFinancialData(queryClient, "debtChanged");
    },
  });
}

export function useDeleteDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ debtId, householdId }: { debtId: string; householdId: string }) => {
      const response = await fetch(
        `/api/debts/${debtId}?${new URLSearchParams({ householdId })}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo eliminar la deuda.");
      return payload;
    },
    onSuccess: () => {
      toast.success("Deuda eliminada.");
      invalidateFinancialData(queryClient, "debtChanged");
    },
    onError: (err) => toast.error(err.message),
  });
}

type DebtPaymentInput = {
  householdId: string;
  debtId: string;
  accountId: string;
  amount: number;
  currency: "ARS" | "USD";
  debtName: string;
  occurredAt: string;
};

export function usePayDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DebtPaymentInput) => {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: input.householdId,
          type: "DEBT_PAYMENT",
          status: "CONFIRMED",
          accountId: input.accountId,
          debtId: input.debtId,
          amount: input.amount,
          currency: input.currency,
          description: `Pago: ${input.debtName}`,
          occurredAt: input.occurredAt,
        }),
      });
      const payload = (await response.json()) as { error?: string; fieldErrors?: Record<string, string> };
      if (!response.ok) {
        const err = new Error(payload.error ?? "No se pudo registrar el pago.");
        (err as Error & { fieldErrors?: Record<string, string> }).fieldErrors = payload.fieldErrors;
        throw err;
      }
      return { debtName: input.debtName, debtId: input.debtId, amount: input.amount };
    },
    onSuccess: () => {
      invalidateFinancialData(queryClient, "transactionChanged");
    },
  });
}
