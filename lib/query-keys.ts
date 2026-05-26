export const queryKeys = {
  dashboard: {
    all: ["dashboard"] as const,
    summary: (year: number, month: number) =>
      ["dashboard", "summary", year, month] as const,
  },

  transactions: {
    all: ["transactions"] as const,
    list: (householdId: string, filters?: Record<string, string>) =>
      ["transactions", "list", householdId, filters] as const,
    activity: (householdId: string) =>
      ["transactions", "activity", householdId] as const,
  },

  goals: {
    all: ["goals"] as const,
    list: (householdId: string) => ["goals", "list", householdId] as const,
  },

  budgets: {
    all: ["budgets"] as const,
    list: (householdId: string, year: number, month: number) =>
      ["budgets", "list", householdId, year, month] as const,
    suggestions: (householdId: string, year: number, month: number) =>
      ["budgets", "suggestions", householdId, year, month] as const,
  },

  recurring: {
    all: ["recurring"] as const,
    list: (householdId: string, filter?: string) =>
      ["recurring", "list", householdId, filter] as const,
  },

  debts: {
    all: ["debts"] as const,
    list: (householdId: string, status?: string) =>
      ["debts", "list", householdId, status] as const,
  },

  creditCards: {
    all: ["creditCards"] as const,
    list: (householdId: string) => ["creditCards", "list", householdId] as const,
  },

  household: {
    all: ["household"] as const,
    balance: (householdId: string) =>
      ["household", "balance", householdId] as const,
  },

  agreements: {
    all: ["agreements"] as const,
    list: (householdId: string, filters?: Record<string, string>) =>
      ["agreements", "list", householdId, filters] as const,
    detail: (id: string) => ["agreements", "detail", id] as const,
  },

  contacts: {
    all: ["contacts"] as const,
    list: (householdId: string, search?: string) =>
      ["contacts", "list", householdId, search] as const,
  },

  ccSummary: {
    all: ["ccSummary"] as const,
    list: (householdId: string) => ["ccSummary", "list", householdId] as const,
  },
} as const;
