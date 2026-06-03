import type { PeriodStatus } from "@/lib/period-status";
import type {
  AccountOption,
  CategoryType,
  CurrencyCode,
  FeedSummary,
  TransactionItem,
  TransactionType,
} from "./types";
import { supportedFormTransactionTypes } from "./constants";

export interface DateGroupContext {
  periodStatus?: PeriodStatus;
  periodYear?: number;
  periodMonth?: number;
}

export function getPreferredArsBankAccount(accounts: AccountOption[]) {
  return (
    accounts.find((account) => account.currency === "ARS" && account.type === "BANK" && account.name.toLowerCase() === "cuenta bancaria") ??
    accounts.find((account) => account.currency === "ARS" && account.type === "BANK") ??
    accounts.find((account) => account.currency === "ARS") ??
    accounts[0]
  );
}

// Returns the CREDIT_CARD account with the highest absolute debt (most negative balance).
// Falls back to the first CC if none carry debt.
export function getHighestDebtCreditCard(accounts: AccountOption[]): AccountOption | undefined {
  if (accounts.length === 0) return undefined;
  const withDebt = accounts.filter((a) => parseFloat(a.currentBalance) < 0);
  if (withDebt.length === 0) return accounts[0];
  return withDebt.reduce((prev, curr) =>
    parseFloat(curr.currentBalance) < parseFloat(prev.currentBalance) ? curr : prev,
  );
}

// Returns true when two accounts have different currencies (cross-currency mismatch).
export function detectCurrencyMismatch(
  srcAccount: AccountOption | undefined,
  dstAccount: AccountOption | undefined,
): boolean {
  if (!srcAccount || !dstAccount) return false;
  return srcAccount.currency !== dstAccount.currency;
}

// Sorts accounts so that those matching the given currency appear first.
export function sortAccountsByCurrency(
  accounts: AccountOption[],
  preferredCurrency: CurrencyCode,
): AccountOption[] {
  return [
    ...accounts.filter((a) => a.currency === preferredCurrency),
    ...accounts.filter((a) => a.currency !== preferredCurrency),
  ];
}

export function optionalPayloadValue(value: unknown, shouldClearWithNull: boolean) {
  return value === "" || value == null ? (shouldClearWithNull ? null : undefined) : value;
}

export function groupTransactionsByDate(transactions: TransactionItem[], context?: DateGroupContext) {
  const groups = new Map<string, TransactionItem[]>();

  transactions.forEach((transaction) => {
    const label = getDateGroupLabel(transaction.occurredAt, context ?? {});
    groups.set(label, [...(groups.get(label) ?? []), transaction]);
  });

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    transactions: items,
  }));
}

export function buildFeedSummary(transactions: TransactionItem[]): FeedSummary {
  const byCurrency: FeedSummary["byCurrency"] = {};
  let count = 0;

  for (const transaction of transactions) {
    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount)) continue;
    const cur = transaction.currency;
    if (!byCurrency[cur]) byCurrency[cur] = { income: 0, expenses: 0 };

    if (transaction.type === "INCOME" || transaction.type === "PERSONAL_LOAN_RETURN") {
      byCurrency[cur]!.income += amount;
    } else if (
      transaction.type === "EXPENSE" ||
      transaction.type === "DEBT_PAYMENT" ||
      transaction.type === "GOAL_CONTRIBUTION" ||
      transaction.type === "INVESTMENT"
    ) {
      byCurrency[cur]!.expenses += amount;
    }
    count += 1;
  }

  return { byCurrency, count };
}

export function getDateGroupLabel(value: string, context: DateGroupContext = {}): string {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  const date = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = today - 86_400_000;
  const weekStart = today - (((now.getDay() + 6) % 7) * 86_400_000);

  const { periodStatus, periodYear, periodMonth } = context;

  // CLOSED period: group all dates within the period by week-of-month
  if (periodStatus === "CLOSED" && periodYear && periodMonth) {
    if (y === periodYear && m === periodMonth) {
      return weekOfMonthLabel(d, y, m);
    }
    return monthYearLabel(date);
  }

  // OPEN or no period: relative labels anchored to today
  if (date === today) return "Hoy";
  if (date === yesterday) return "Ayer";
  if (date >= weekStart && date < yesterday) return "Esta semana";

  // Earlier dates within the current period month: week-of-month
  if (periodStatus === "OPEN" && periodYear && periodMonth && y === periodYear && m === periodMonth) {
    return weekOfMonthLabel(d, y, m);
  }

  return monthYearLabel(date);
}

function weekOfMonthLabel(day: number, year: number, month: number): string {
  const weekNum = Math.ceil(day / 7);
  const weekStart = (weekNum - 1) * 7 + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const weekEnd = Math.min(weekNum * 7, daysInMonth);
  const monthName = new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
  return `Semana ${weekNum} · ${weekStart}–${weekEnd} ${monthName}`;
}

function monthYearLabel(date: number): string {
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

export function getTransactionTone(type: TransactionType) {
  if (type === "INCOME") {
    return {
      icon: "bg-emerald-500/15 text-emerald-500",
      amount: "text-emerald-500",
      badge: "bg-emerald-500/10 text-emerald-500",
    };
  }

  if (type === "TRANSFER") {
    return {
      icon: "bg-sky-500/15 text-sky-500",
      amount: "text-sky-500",
      badge: "bg-sky-500/10 text-sky-500",
    };
  }

  return {
    icon: "bg-rose-500/15 text-rose-500",
    amount: "text-rose-500",
    badge: "bg-rose-500/10 text-rose-500",
  };
}

export function getSignedAmount(transaction: TransactionItem) {
  const raw = transaction.isHouseholdPayment && transaction.userShareAmount != null
    ? Number(transaction.userShareAmount)
    : Number(transaction.amount);
  const amount = Number.isFinite(raw) ? raw : 0;
  if (transaction.type === "INCOME" || transaction.type === "PERSONAL_LOAN_RETURN") return amount;
  if (transaction.type === "TRANSFER" || transaction.type === "CARD_PAYMENT" || transaction.type === "PERSONAL_LOAN_GIVEN") return 0;
  return -amount;
}

export function getDisplayAmount(transaction: TransactionItem) {
  if (transaction.isHouseholdPayment && transaction.userShareAmount != null) {
    const share = Number(transaction.userShareAmount);
    return Number.isFinite(share) ? share : 0;
  }
  const amount = Number(transaction.amount);
  return Number.isFinite(amount) ? amount : 0;
}

export function isCategoryAllowedForType(categoryType: CategoryType, transactionType: TransactionType) {
  if (transactionType === "INCOME") {
    return categoryType === "INCOME";
  }

  if (transactionType === "EXPENSE") {
    return categoryType === "EXPENSE";
  }

  if (transactionType === "DEBT_PAYMENT") {
    return categoryType === "DEBT";
  }

  if (transactionType === "GOAL_CONTRIBUTION") {
    return categoryType === "GOAL";
  }

  if (transactionType === "INVESTMENT") {
    return categoryType === "INVESTMENT";
  }

  return categoryType === "TRANSFER" || categoryType === "ADJUSTMENT";
}

export function isSupportedFormTransactionType(type: TransactionType) {
  return supportedFormTransactionTypes.includes(
    type as (typeof supportedFormTransactionTypes)[number],
  );
}

export function formatMoney(value: string | number, currency: CurrencyCode) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatMoneyBalance(value: number, currency: CurrencyCode = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "ARS" ? 0 : 2,
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
