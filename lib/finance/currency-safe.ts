import type { CurrencyCode, Prisma } from "@prisma/client";

export type SupportedCurrency = CurrencyCode | string;

export type CurrencyTotal = {
  currency: SupportedCurrency;
  amount: number;
  count: number;
};

export type FxSource = "user_configured" | "manual" | "unavailable";

export type EstimatedEquivalent = {
  amount: number;
  currency: SupportedCurrency;
  fxRate: number;
  source: FxSource;
  approximate: true;
};

export type CurrencyTruth = CurrencyTotal & {
  equivalent?: EstimatedEquivalent;
};

export function toFiniteMoney(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return 0;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function sumByCurrency<T>(
  items: T[],
  getCurrency: (item: T) => SupportedCurrency,
  getAmount: (item: T) => Prisma.Decimal | number | string | null | undefined,
): CurrencyTotal[] {
  const totals = new Map<SupportedCurrency, CurrencyTotal>();

  for (const item of items) {
    const currency = getCurrency(item);
    const current = totals.get(currency) ?? { currency, amount: 0, count: 0 };
    current.amount += toFiniteMoney(getAmount(item));
    current.count += 1;
    totals.set(currency, current);
  }

  return sortCurrencyTotals(Array.from(totals.values()).map((total) => ({
    ...total,
    amount: roundMoney(total.amount),
  })));
}

export function amountForCurrency(totals: CurrencyTotal[], currency: SupportedCurrency) {
  return totals.find((total) => total.currency === currency)?.amount ?? 0;
}

export function filterCurrency<T>(
  items: T[],
  currency: SupportedCurrency,
  getCurrency: (item: T) => SupportedCurrency,
) {
  return items.filter((item) => getCurrency(item) === currency);
}

export function otherCurrencyTotals(totals: CurrencyTotal[], primaryCurrency: SupportedCurrency) {
  return totals.filter((total) => total.currency !== primaryCurrency && total.amount !== 0);
}

export function hasMixedCurrencies(totals: CurrencyTotal[]) {
  return totals.filter((total) => total.amount !== 0 || total.count > 0).length > 1;
}

export function assertSingleCurrency<T>(
  items: T[],
  getCurrency: (item: T) => SupportedCurrency,
  context: string,
) {
  const currencies = new Set(items.map(getCurrency));
  if (currencies.size > 1) {
    throw new Error(`${context} received mixed currencies: ${Array.from(currencies).join(", ")}`);
  }
}

export function sortCurrencyTotals(totals: CurrencyTotal[]) {
  return [...totals].sort((a, b) => {
    if (a.currency === "ARS") return -1;
    if (b.currency === "ARS") return 1;
    if (a.currency === "USD") return -1;
    if (b.currency === "USD") return 1;
    return String(a.currency).localeCompare(String(b.currency));
  });
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
