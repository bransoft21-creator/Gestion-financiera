import { Prisma } from "@prisma/client";
import { toFiniteNumber } from "./financial-ledger";

type DebugAccount = {
  id: string;
  type: string;
  currency?: string;
  currentBalance: Prisma.Decimal | number;
  isArchived?: boolean;
};

type DebugDebt = {
  id: string;
  type: string;
  status: string;
  currency?: string;
  outstandingAmount: Prisma.Decimal | number;
};

type DebugSnapshot = {
  id: string;
  year: number;
  month: number;
  debtOutstandingAmount: Prisma.Decimal | number;
};

type FinancialTracePayload = {
  endpoint: string;
  householdId: string;
  source: string;
  computed?: Record<string, number>;
  accounts?: DebugAccount[];
  debts?: DebugDebt[];
  snapshots?: DebugSnapshot[];
};

export function traceFinancialSource(payload: FinancialTracePayload) {
  if (process.env.NODE_ENV !== "development") return;

  console.info("[financial-trace]", {
    endpoint: payload.endpoint,
    householdId: maskId(payload.householdId),
    source: payload.source,
    computed: payload.computed,
    accounts: payload.accounts?.map((account) => ({
      id: maskId(account.id),
      type: account.type,
      currency: account.currency,
      balance: toFiniteNumber(account.currentBalance),
      archived: account.isArchived ?? false,
    })),
    debts: payload.debts?.map((debt) => ({
      id: maskId(debt.id),
      type: debt.type,
      status: debt.status,
      currency: debt.currency,
      outstanding: toFiniteNumber(debt.outstandingAmount),
    })),
    snapshots: payload.snapshots?.map((snapshot) => ({
      id: maskId(snapshot.id),
      period: `${snapshot.year}-${String(snapshot.month).padStart(2, "0")}`,
      debtOutstanding: toFiniteNumber(snapshot.debtOutstandingAmount),
    })),
  });
}

function maskId(id: string) {
  return id.slice(-6);
}
