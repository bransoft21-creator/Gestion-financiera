"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { invalidateFinancialData } from "@/lib/invalidate";

export type RecurringItem = {
  id: string;
  name: string;
  currency: "ARS" | "USD";
  amount: number;
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  nextDueDate: string;
  endDate: string | null;
  isActive: boolean;
  notes: string | null;
  daysUntilDue: number;
  isDueSoon: boolean;
  account: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
};

type RecurringFilter = "all" | "active" | "inactive";

async function fetchRecurring(householdId: string, filter: RecurringFilter) {
  const params = new URLSearchParams({ householdId });
  if (filter === "active") params.set("isActive", "true");
  if (filter === "inactive") params.set("isActive", "false");
  const response = await fetch(`/api/recurring-expenses?${params}`);
  const payload = (await response.json()) as {
    data?: { recurringExpenses: RecurringItem[]; upcomingCount: number };
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar los recurrentes.");
  return payload.data ?? { recurringExpenses: [], upcomingCount: 0 };
}

export function useRecurringExpenses(householdId: string, filter: RecurringFilter = "all") {
  return useQuery({
    queryKey: queryKeys.recurring.list(householdId, filter),
    queryFn: () => fetchRecurring(householdId, filter),
    staleTime: 30_000,
  });
}

type SaveRecurringInput = {
  householdId: string;
  name: string;
  currency: "ARS" | "USD";
  amount: number;
  frequency: string;
  nextDueDate: string;
  endDate?: string | null;
  accountId?: string | null;
  categoryId?: string | null;
  notes?: string | null;
};

export function useCreateRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveRecurringInput) => {
      const response = await fetch("/api/recurring-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as { error?: string; fieldErrors?: Record<string, string> };
      if (!response.ok) {
        const err = new Error(payload.error ?? "No se pudo crear el recurrente.");
        (err as Error & { fieldErrors?: Record<string, string> }).fieldErrors = payload.fieldErrors;
        throw err;
      }
      return payload;
    },
    onSuccess: () => {
      toast.success("Recurrente creado.");
      invalidateFinancialData(queryClient, "recurringChanged");
    },
  });
}

export function useUpdateRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: SaveRecurringInput & { id: string }) => {
      const response = await fetch(`/api/recurring-expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as { error?: string; fieldErrors?: Record<string, string> };
      if (!response.ok) {
        const err = new Error(payload.error ?? "No se pudo actualizar el recurrente.");
        (err as Error & { fieldErrors?: Record<string, string> }).fieldErrors = payload.fieldErrors;
        throw err;
      }
      return payload;
    },
    onSuccess: () => {
      toast.success("Recurrente actualizado.");
      invalidateFinancialData(queryClient, "recurringChanged");
    },
  });
}

export function useToggleRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      householdId,
      isActive,
    }: {
      id: string;
      householdId: string;
      isActive: boolean;
    }) => {
      const response = await fetch(`/api/recurring-expenses/${id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId, isActive }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo cambiar el estado.");
      return { wasActive: !isActive };
    },
    onSuccess: ({ wasActive }) => {
      toast.success(wasActive ? "Recurrente pausado." : "Recurrente activado.");
      invalidateFinancialData(queryClient, "recurringChanged");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, householdId }: { id: string; householdId: string }) => {
      const response = await fetch(
        `/api/recurring-expenses/${id}?${new URLSearchParams({ householdId })}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo eliminar el recurrente.");
      return payload;
    },
    onSuccess: () => {
      toast.success("Recurrente eliminado.");
      invalidateFinancialData(queryClient, "recurringChanged");
    },
    onError: (err) => toast.error(err.message),
  });
}

type PayRecurringInput = {
  householdId: string;
  item: Pick<RecurringItem, "id" | "name" | "amount" | "currency"> & {
    account: { id: string } | null;
    category: { id: string } | null;
  };
  occurredAt: string;
};

export function usePayRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ householdId, item, occurredAt }: PayRecurringInput) => {
      if (!item.account) throw new Error("Asigná una cuenta al recurrente antes de registrar el pago.");
      const response = await fetch(`/api/recurring-expenses/${item.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId,
          accountId: item.account.id,
          occurredAt,
        }),
      });
      const payload = (await response.json()) as { data?: { transactionId: string; nextDueDate: string }; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo registrar el pago.");
      return { name: item.name, nextDueDate: payload.data?.nextDueDate };
    },
    onSuccess: ({ name, nextDueDate }) => {
      const nextFormatted = nextDueDate
        ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(nextDueDate))
        : null;
      toast.success(`Pago de ${name} registrado.${nextFormatted ? ` Próximo: ${nextFormatted}.` : ""}`);
      invalidateFinancialData(queryClient, "recurringChanged");
    },
    onError: (err) => toast.error(err.message),
  });
}
