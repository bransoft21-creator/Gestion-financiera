"use client";

import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

/**
 * Returns a function that invalidates all modules affected by a transaction change.
 * Call after any create/update/delete transaction operation.
 */
export function useInvalidateAfterTransaction() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.goals.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.debts.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.recurring.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
  };
}
