"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { CCSummary } from "@/server/services/cc-summary";

export type { CCSummary };

async function fetchCCSummaries(householdId: string): Promise<CCSummary[]> {
  const res = await fetch(`/api/cc-summary?${new URLSearchParams({ householdId })}`);
  const payload = (await res.json()) as { data?: { summaries: CCSummary[] }; error?: string };
  if (!res.ok) throw new Error(payload.error ?? "No se pudieron cargar los resúmenes de tarjeta.");
  return payload.data?.summaries ?? [];
}

export function useCCSummaries(householdId: string) {
  return useQuery({
    queryKey: queryKeys.ccSummary.list(householdId),
    queryFn: () => fetchCCSummaries(householdId),
    staleTime: 30_000,
  });
}
