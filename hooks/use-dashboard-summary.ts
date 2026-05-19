"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { DashboardSummary } from "@/app/(private)/dashboard/types";

async function fetchDashboardSummary(year: number, month: number): Promise<DashboardSummary | null> {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  const response = await fetch(`/api/dashboard/summary?${params}`);
  const payload = (await response.json()) as { data?: DashboardSummary; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar el dashboard.");
  return payload.data ?? null;
}

export function useDashboardSummary(year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.dashboard.summary(year, month),
    queryFn: () => fetchDashboardSummary(year, month),
    staleTime: 10_000,
    retry: 1,
  });
}
