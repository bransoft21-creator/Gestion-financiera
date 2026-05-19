"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { invalidateFinancialData } from "@/lib/invalidate";

export type BudgetItem = {
  id: string;
  categoryId: string;
  currency: "ARS" | "USD";
  year: number;
  month: number;
  plannedAmount: number;
  reservedAmount: number;
  remainingReserved: number;
  spentAmount: number;
  usagePercent: number;
  category: { id: string; name: string; color: string | null };
};

export type BudgetSuggestion = {
  categoryId: string;
  category: { id: string; name: string; color: string | null };
  currency: "ARS" | "USD";
  suggestedAmount: number;
  recentAverage: number;
  recurringAmount: number;
  activeMonths: number;
  transactionCount: number;
  variability: "stable" | "variable" | "partial";
  incomeSharePercent: number | null;
  confidence: "high" | "medium" | "starter";
  reason: string;
};

type BudgetSuggestionsData = {
  suggestions: BudgetSuggestion[];
  recentMonthlyIncome: number;
  hasHistoricalActivity: boolean;
};

async function fetchBudgets(householdId: string, year: number, month: number): Promise<BudgetItem[]> {
  const params = new URLSearchParams({ householdId, year: String(year), month: String(month) });
  const response = await fetch(`/api/budgets?${params}`);
  const payload = (await response.json()) as { data?: BudgetItem[]; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar los presupuestos.");
  return payload.data ?? [];
}

async function fetchBudgetSuggestions(householdId: string, year: number, month: number): Promise<BudgetSuggestionsData> {
  const params = new URLSearchParams({ householdId, year: String(year), month: String(month) });
  const response = await fetch(`/api/budgets/suggestions?${params}`);
  const payload = (await response.json()) as {
    data?: BudgetSuggestionsData;
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error ?? "No pudimos preparar sugerencias.");
  return payload.data ?? { suggestions: [], recentMonthlyIncome: 0, hasHistoricalActivity: false };
}

export function useBudgets(householdId: string, year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.budgets.list(householdId, year, month),
    queryFn: () => fetchBudgets(householdId, year, month),
    staleTime: 30_000,
  });
}

export function useBudgetSuggestions(householdId: string, year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.budgets.suggestions(householdId, year, month),
    queryFn: () => fetchBudgetSuggestions(householdId, year, month),
    staleTime: 120_000,
  });
}

type SaveBudgetInput = {
  householdId: string;
  categoryId: string;
  currency: "ARS" | "USD";
  year: number;
  month: number;
  plannedAmount: number;
};

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveBudgetInput) => {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as { error?: string; fieldErrors?: Record<string, string> };
      if (!response.ok) {
        const err = new Error(payload.error ?? "No se pudo crear el presupuesto.");
        (err as Error & { fieldErrors?: Record<string, string> }).fieldErrors = payload.fieldErrors;
        throw err;
      }
      return payload;
    },
    onSuccess: () => {
      toast.success("Presupuesto creado.");
      invalidateFinancialData(queryClient, "budgetChanged");
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ budgetId, ...input }: SaveBudgetInput & { budgetId: string }) => {
      const response = await fetch(`/api/budgets/${budgetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as { error?: string; fieldErrors?: Record<string, string> };
      if (!response.ok) {
        const err = new Error(payload.error ?? "No se pudo actualizar el presupuesto.");
        (err as Error & { fieldErrors?: Record<string, string> }).fieldErrors = payload.fieldErrors;
        throw err;
      }
      return payload;
    },
    onSuccess: () => {
      toast.success("Presupuesto actualizado.");
      invalidateFinancialData(queryClient, "budgetChanged");
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ budgetId, householdId }: { budgetId: string; householdId: string }) => {
      const response = await fetch(
        `/api/budgets/${budgetId}?${new URLSearchParams({ householdId })}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo eliminar el presupuesto.");
      return payload;
    },
    onSuccess: () => {
      toast.success("Presupuesto eliminado.");
      invalidateFinancialData(queryClient, "budgetChanged");
    },
    onError: (err) => toast.error(err.message),
  });
}
