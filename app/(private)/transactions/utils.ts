import type {
  AccountOption,
  CategoryType,
  CurrencyCode,
  FeedSummary,
  TransactionItem,
  TransactionType,
} from "./types";
import { supportedFormTransactionTypes } from "./constants";

export function getPreferredArsBankAccount(accounts: AccountOption[]) {
  return (
    accounts.find((account) => account.currency === "ARS" && account.type === "BANK" && account.name.toLowerCase() === "cuenta bancaria") ??
    accounts.find((account) => account.currency === "ARS" && account.type === "BANK") ??
    accounts.find((account) => account.currency === "ARS") ??
    accounts[0]
  );
}

export function optionalPayloadValue(value: unknown, shouldClearWithNull: boolean) {
  return value === "" || value == null ? (shouldClearWithNull ? null : undefined) : value;
}

export function groupTransactionsByDate(transactions: TransactionItem[]) {
  const groups = new Map<string, TransactionItem[]>();

  transactions.forEach((transaction) => {
    const label = getDateGroupLabel(transaction.occurredAt);
    groups.set(label, [...(groups.get(label) ?? []), transaction]);
  });

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    transactions: items,
  }));
}

export function buildFeedSummary(transactions: TransactionItem[]): FeedSummary {
  return transactions.reduce(
    (summary, transaction) => {
      const amount = Number(transaction.amount);
      if (!Number.isFinite(amount)) return summary;

      if (transaction.type === "INCOME") {
        summary.income += amount;
      } else if (transaction.type !== "TRANSFER") {
        summary.expenses += amount;
      }
      summary.count += 1;
      return summary;
    },
    { income: 0, expenses: 0, count: 0 },
  );
}

export function getDateGroupLabel(value: string) {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  const date = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = today - 86_400_000;
  const weekStart = today - (((now.getDay() + 6) % 7) * 86_400_000);

  if (date === today) return "Hoy";
  if (date === yesterday) return "Ayer";
  if (date >= weekStart && date < yesterday) return "Esta semana";

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
  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount)) return 0;
  if (transaction.type === "INCOME") return amount;
  if (transaction.type === "TRANSFER") return 0;
  return -amount;
}

export function getDisplayAmount(transaction: TransactionItem) {
  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount)) return 0;
  return amount;
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

export function formatMoneyBalance(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
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
