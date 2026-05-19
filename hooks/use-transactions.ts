"use client";

import { useQueryClient } from "@tanstack/react-query";
import { invalidateFinancialData, type InvalidationScope } from "@/lib/invalidate";

/**
 * Returns a function that invalidates all modules affected by a financial action.
 * Defaults to "transactionChanged" which covers create/update/delete of any transaction.
 */
export function useInvalidateAfterTransaction() {
  const queryClient = useQueryClient();
  return (scope: InvalidationScope = "transactionChanged") => {
    invalidateFinancialData(queryClient, scope);
  };
}
