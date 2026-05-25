import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

/**
 * Scopes define which modules need to be invalidated after a financial action.
 *
 * AI briefings (monthly/weekly) are NOT included in any scope — they are
 * expensive AI computations and only invalidated on explicit user request.
 */
export type InvalidationScope =
  | "transactionChanged"  // create / edit / delete any transaction
  | "goalChanged"         // create / edit / delete goal definition
  | "debtChanged"         // create / edit / delete debt definition
  | "recurringChanged"    // create / edit / toggle / delete recurring definition
  | "budgetChanged"       // create / edit / delete budget
  | "importConfirmed"     // Smart Import batch confirm
  | "dataQualityChanged"  // bulk categorize / merge / reclassify
  | "agreementChanged"    // create / event / close personal agreement
  | "contactChanged";     // create / update contact

type QueryKey = readonly unknown[];

const SCOPE_KEYS: Record<InvalidationScope, QueryKey[]> = {
  transactionChanged: [
    queryKeys.transactions.all,
    queryKeys.dashboard.all,
    queryKeys.goals.all,
    queryKeys.debts.all,
    queryKeys.recurring.all,
    queryKeys.budgets.all,
  ],
  goalChanged: [
    queryKeys.goals.all,
    queryKeys.dashboard.all,
  ],
  debtChanged: [
    queryKeys.debts.all,
    queryKeys.dashboard.all,
  ],
  recurringChanged: [
    queryKeys.recurring.all,
    queryKeys.dashboard.all,
  ],
  budgetChanged: [
    queryKeys.budgets.all,
    queryKeys.dashboard.all,
  ],
  importConfirmed: [
    queryKeys.transactions.all,
    queryKeys.dashboard.all,
    queryKeys.goals.all,
    queryKeys.debts.all,
    queryKeys.recurring.all,
    queryKeys.budgets.all,
  ],
  dataQualityChanged: [
    queryKeys.transactions.all,
    queryKeys.dashboard.all,
    queryKeys.budgets.all,
  ],
  agreementChanged: [
    queryKeys.agreements.all,
    queryKeys.contacts.all,
  ],
  contactChanged: [
    queryKeys.contacts.all,
  ],
};

export function invalidateFinancialData(
  queryClient: QueryClient,
  scope: InvalidationScope,
): void {
  for (const key of SCOPE_KEYS[scope]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}
