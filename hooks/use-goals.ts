"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";

export type GoalItem = {
  id: string;
  name: string;
  currency: "ARS" | "USD";
  targetAmount: number;
  currentAmount: number;
  requiredMonthlyAmount: number | null;
  targetDate: string | null;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELED";
  notes: string | null;
};

async function fetchGoals(householdId: string): Promise<GoalItem[]> {
  const response = await fetch(`/api/goals?${new URLSearchParams({ householdId })}`);
  const payload = (await response.json()) as { data?: GoalItem[]; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar las metas.");
  return payload.data ?? [];
}

export function useGoals(householdId: string) {
  return useQuery({
    queryKey: queryKeys.goals.list(householdId),
    queryFn: () => fetchGoals(householdId),
    staleTime: 60_000,
  });
}

function useGoalInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.goals.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  };
}

type CreateGoalInput = {
  householdId: string;
  name: string;
  currency: "ARS" | "USD";
  targetAmount: number;
  currentAmount: number;
  requiredMonthlyAmount?: number | null;
  targetDate?: string | null;
  status: string;
  notes?: string | null;
};

type UpdateGoalInput = CreateGoalInput & { goalId: string };

export function useCreateGoal() {
  const invalidate = useGoalInvalidation();
  return useMutation({
    mutationFn: async (input: CreateGoalInput) => {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as { error?: string; fieldErrors?: Record<string, string> };
      if (!response.ok) {
        const err = new Error(payload.error ?? "No se pudo crear la meta.");
        (err as Error & { fieldErrors?: Record<string, string> }).fieldErrors = payload.fieldErrors;
        throw err;
      }
      return payload;
    },
    onSuccess: () => {
      toast.success("Meta creada.");
      invalidate();
    },
  });
}

export function useUpdateGoal() {
  const invalidate = useGoalInvalidation();
  return useMutation({
    mutationFn: async ({ goalId, ...input }: UpdateGoalInput) => {
      const response = await fetch(`/api/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await response.json()) as { error?: string; fieldErrors?: Record<string, string> };
      if (!response.ok) {
        const err = new Error(payload.error ?? "No se pudo actualizar la meta.");
        (err as Error & { fieldErrors?: Record<string, string> }).fieldErrors = payload.fieldErrors;
        throw err;
      }
      return payload;
    },
    onSuccess: () => {
      toast.success("Meta actualizada.");
      invalidate();
    },
  });
}

export function useDeleteGoal() {
  const invalidate = useGoalInvalidation();
  return useMutation({
    mutationFn: async ({ goalId, householdId }: { goalId: string; householdId: string }) => {
      const response = await fetch(
        `/api/goals/${goalId}?${new URLSearchParams({ householdId })}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo eliminar la meta.");
      return payload;
    },
    onSuccess: () => {
      toast.success("Meta eliminada.");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}

type GoalContributionInput = {
  householdId: string;
  accountId: string;
  goalId: string;
  amount: number;
  currency: "ARS" | "USD";
  goalName: string;
  occurredAt: string;
};

export function useGoalContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: GoalContributionInput) => {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: input.householdId,
          type: "GOAL_CONTRIBUTION",
          status: "CONFIRMED",
          accountId: input.accountId,
          goalId: input.goalId,
          amount: input.amount,
          currency: input.currency,
          description: `Aporte: ${input.goalName}`,
          occurredAt: input.occurredAt,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo registrar el aporte.");
      return { goalName: input.goalName };
    },
    onSuccess: ({ goalName }) => {
      toast.success(`Aporte a "${goalName}" registrado correctamente.`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.goals.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: (err) => toast.error(err.message),
  });
}
