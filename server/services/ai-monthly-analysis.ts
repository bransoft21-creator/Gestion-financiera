import { createHash } from "node:crypto";
import { AccountType, PaymentMethod, Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { argentinaMonthRangeUtc, formatArgentinaDateInput } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/errors";
import { captureServerMessage } from "@/lib/observability/server";
import { estimateTextTokens, recordAiUsage } from "@/server/services/ai-usage";
import { traceAi, traceUserId } from "@/server/services/ai-trace";
import { toFiniteNumber } from "./financial-ledger";
import { assertHouseholdAccess } from "./households";
import { buildMonthlySystemPrompt } from "@/lib/ai/prompt-governance";
import { normalizeMerchant, toDisplayName, toGroupingKey } from "@/lib/merchant/normalize";
import { filterCurrency, sumByCurrency } from "@/lib/finance/currency-safe";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const HIGH_IMPACT_INCOME_RATE = 5;
const FIXED_CATEGORY_NAMES = [
  "Alquiler / Hipoteca",
  "Expensas",
  "Cuota Auto",
  "Internet / Telefonía",
  "Servicios",
  "Suscripciones",
  "Salud",
  "Estacionamiento",
] as const;
const MOBILITY_CATEGORY_NAMES = [
  "Cuota Auto",
  "Combustible",
  "Estacionamiento",
  "Transporte",
] as const;

// Categories and description patterns that are NEVER "gastos invisibles":
// essential, planned, or high-value purchases that repeat legitimately.
const ESSENTIAL_CATEGORY_NAMES = [
  "Supermercado",
  "Mercado",
  "Almacén",
  "Verdulería",
  "Carnicería",
  "Farmacia",
  "Salud",
  "Médico",
  "Alquiler / Hipoteca",
  "Expensas",
  "Servicios",
  "Internet / Telefonía",
  "Suscripciones",
  "Educación",
  "Cuota Auto",
  "Combustible",
  "Estacionamiento",
  "Transporte",
  "Colegiaturas",
] as const;

// Normalized merchant fragments to exclude from repeatedSmallExpenses.
// Matches if the normalized description CONTAINS any of these strings.
const ESSENTIAL_DESCRIPTION_FRAGMENTS = [
  "coto",
  "carrefour",
  "walmart",
  "dia ",
  " dia ",
  "jumbo",
  "disco",
  "vea ",
  "changomas",
  "chango mas",
  "lidl",
  "makro",
  "mayorista",
  "farmacity",
  "farmacias",
  "farmacia",
  "drogueria",
  "osde",
  "swiss medical",
  "galeno",
  "prepaga",
  "obra social",
  "arcor",
  "edenor",
  "edesur",
  "metrogas",
  "naturgy",
  "aysa",
  "telecentro",
  "fibertel",
  "claro",
  "personal ",
  "movistar",
  "directv",
  "netflix",
  "spotify",
  "amazon",
] as const;

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "score", "positivePoints", "alerts", "recommendations", "riskPoints"],
  properties: {
    summary: { type: "string" },
    score: { type: "number", minimum: 0, maximum: 100 },
    positivePoints: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "message"],
        properties: {
          title: { type: "string" },
          message: { type: "string" },
        },
      },
    },
    alerts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "title", "message"],
        properties: {
          severity: { type: "string", enum: ["low", "medium", "high"] },
          title: { type: "string" },
          message: { type: "string" },
        },
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "message", "estimatedImpact"],
        properties: {
          title: { type: "string" },
          message: { type: "string" },
          estimatedImpact: { type: "string" },
        },
      },
    },
    riskPoints: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "message"],
        properties: {
          title: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
} as const;

const analysisTransactionInclude = {
  account: { select: { id: true, name: true, type: true } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.TransactionInclude;

type AnalysisTransaction = Prisma.TransactionGetPayload<{
  include: typeof analysisTransactionInclude;
}>;

export type AiFinancialAnalysisResult = {
  summary: string;
  score: number;
  positivePoints: Array<{ title: string; message: string }>;
  alerts: Array<{ severity: "low" | "medium" | "high"; title: string; message: string }>;
  recommendations: Array<{ title: string; message: string; estimatedImpact: string }>;
  riskPoints: Array<{ title: string; message: string }>;
};

export type AiFinancialAnalysisMetrics = {
  month: string;
  currency: string;
  currencyScope: {
    primaryCurrency: string;
    totalsByCurrency: Array<{ currency: string; amount: number; count: number }>;
    ignoredCurrencies: string[];
    mixedCurrencies: boolean;
  };
  hasData: boolean;
  income: number;
  expenses: number;
  balance: number;
  savingsRate: number;
  fixedExpenseRate: number;
  dailyAverageExpense: number;
  projectedMonthEndExpense: number;
  expensesByCategory: Array<{
    name: string;
    total: number;
    count: number;
  }>;
  expensesByAccount: Array<{
    name: string;
    total: number;
    count: number;
  }>;
  categoryExpensePercentages: Array<{
    name: string;
    total: number;
    percentage: number;
  }>;
  mobilityTotal: number;
  mobilityRate: number;
  highImpactTransactions: Array<{
    date: string;
    amount: number;
    currency: string;
    incomePercentage: number;
    category: string;
    account: string;
    description: string;
  }>;
  repeatedSmallExpenses: Array<{
    description: string;
    normalizedDescription: string;
    count: number;
    total: number;
    averageAmount: number;
    categories: string[];
  }>;
  creditCardExpenseRate: number;
};

export type AiFinancialAnalysisComparison = {
  available: boolean;
  currentMonth: string;
  previousMonth: string;
  incomeChangeAmount: number;
  incomeChangePercent: number | null;
  expenseChangeAmount: number;
  expenseChangePercent: number | null;
  balanceChangeAmount: number;
  balanceChangePercent: number | null;
  savingsRateChange: number;
  fixedExpenseRateChange: number;
  mobilityChangeAmount: number;
  mobilityChangePercent: number | null;
  creditCardRateChange: number;
  categoryChanges: Array<{
    category: string;
    currentAmount: number;
    previousAmount: number;
    changeAmount: number;
    changePercent: number | null;
  }>;
};

export async function generateMonthlyFinancialAnalysis({
  userProfileId,
  householdId,
  month,
}: {
  userProfileId: string;
  householdId: string;
  month: string;
}) {
  await assertHouseholdAccess(userProfileId, householdId);

  const compactBundle = await buildCompactInputForMonth(householdId, month);
  const compactInput = compactBundle.input;
  const inputHash = buildInputHash({
    month,
    previousMonth: compactInput.previousMonthMetrics.month,
    currency: compactInput.currency,
    transactions: compactBundle.currentTransactions,
    previousTransactions: compactBundle.previousTransactions,
  });

  const existing = await prisma.aiFinancialAnalysis.findUnique({
    where: { userId_month: { userId: userProfileId, month } },
  });

  if (existing?.inputHash === inputHash) {
    traceAi("AI_MONTHLY_CACHE_HIT", { user: traceUserId(userProfileId), month });
    return {
      analysis: existing.result as AiFinancialAnalysisResult,
      result: existing.result as AiFinancialAnalysisResult,
      metrics: compactInput.metrics,
      previousMonthMetrics: compactInput.previousMonthMetrics,
      comparison: compactInput.comparison,
      cached: true,
      month,
      generatedAt: existing.updatedAt.toISOString(),
    };
  }

  traceAi("OPENAI_MONTHLY_REQUEST_START", { user: traceUserId(userProfileId), month });
  const analysis = await requestOpenAiAnalysis(compactInput, {
    userId: userProfileId,
    endpoint: "ai.monthly-analysis",
  });
  traceAi("OPENAI_MONTHLY_RESPONSE_OK", { user: traceUserId(userProfileId), month });

  traceAi("AI_MONTHLY_CACHE_WRITE_START", { user: traceUserId(userProfileId), month });
  const saved = await prisma.aiFinancialAnalysis.upsert({
    where: { userId_month: { userId: userProfileId, month } },
    create: {
      userId: userProfileId,
      month,
      inputHash,
      result: analysis,
    },
    update: {
      inputHash,
      result: analysis,
    },
  });
  traceAi("AI_MONTHLY_CACHE_WRITE_OK", { user: traceUserId(userProfileId), month });

  return {
    analysis: saved.result as AiFinancialAnalysisResult,
    result: saved.result as AiFinancialAnalysisResult,
    metrics: compactInput.metrics,
    previousMonthMetrics: compactInput.previousMonthMetrics,
    comparison: compactInput.comparison,
    cached: false,
    month,
    generatedAt: saved.updatedAt.toISOString(),
  };
}

export async function getSavedMonthlyFinancialAnalysis({
  userProfileId,
  householdId,
  month,
}: {
  userProfileId: string;
  householdId: string;
  month: string;
}) {
  await assertHouseholdAccess(userProfileId, householdId);

  const existing = await prisma.aiFinancialAnalysis.findUnique({
    where: { userId_month: { userId: userProfileId, month } },
  });

  if (!existing) {
    return null;
  }

  const compactBundle = await buildCompactInputForMonth(householdId, month);
  const compactInput = compactBundle.input;
  const currentHash = buildInputHash({
    month,
    previousMonth: compactInput.previousMonthMetrics.month,
    currency: compactInput.currency,
    transactions: compactBundle.currentTransactions,
    previousTransactions: compactBundle.previousTransactions,
  });

  const storedResult = existing.result as AiFinancialAnalysisResult;
  // Detect legacy results where AI used a 0–10 scale instead of 0–100.
  // A non-zero score ≤ 10 with real transaction data is almost certainly a scale mismatch.
  const isLegacyScale =
    typeof storedResult.score === "number" &&
    storedResult.score > 0 &&
    storedResult.score <= 10 &&
    compactInput.metrics.hasData;

  return {
    analysis: storedResult,
    result: storedResult,
    metrics: compactInput.metrics,
    previousMonthMetrics: compactInput.previousMonthMetrics,
    comparison: compactInput.comparison,
    cached: true,
    stale: existing.inputHash !== currentHash || isLegacyScale,
    month,
    generatedAt: existing.updatedAt.toISOString(),
  };
}

function parseMonth(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) {
    throw new ApiError(400, "El mes debe tener formato YYYY-MM.");
  }

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (year < 2000 || year > 2100 || monthNumber < 1 || monthNumber > 12) {
    throw new ApiError(400, "El mes está fuera de rango.");
  }

  return { year, monthNumber };
}

async function buildCompactInputForMonth(householdId: string, month: string) {
  const { year, monthNumber } = parseMonth(month);
  const { start, end } = argentinaMonthRangeUtc(year, monthNumber);
  const previousPeriod = getPreviousMonthPeriod(year, monthNumber);
  const { start: previousStart, end: previousEnd } = argentinaMonthRangeUtc(
    previousPeriod.year,
    previousPeriod.monthNumber,
  );

  const [household, currentTransactions, previousTransactions] = await Promise.all([
    prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { defaultCurrency: true },
    }),
    prisma.transaction.findMany({
      where: {
        householdId,
        deletedAt: null,
        status: { not: TransactionStatus.CANCELED },
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
        occurredAt: { gte: start, lt: end },
      },
      include: analysisTransactionInclude,
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    }),
    prisma.transaction.findMany({
      where: {
        householdId,
        deletedAt: null,
        status: { not: TransactionStatus.CANCELED },
        type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
        occurredAt: { gte: previousStart, lt: previousEnd },
      },
      include: analysisTransactionInclude,
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    }),
  ]);

  return {
    input: buildCompactMonthlyInput({
      primaryCurrency: household.defaultCurrency,
      currentPeriod: { year, monthNumber, month },
      currentTransactions,
      previousPeriod,
      previousTransactions,
    }),
    currentTransactions,
    previousTransactions,
  };
}

function buildCompactMonthlyInput({
  primaryCurrency,
  currentPeriod,
  currentTransactions,
  previousPeriod,
  previousTransactions,
}: {
  primaryCurrency: string;
  currentPeriod: { year: number; monthNumber: number; month: string };
  currentTransactions: AnalysisTransaction[];
  previousPeriod: { year: number; monthNumber: number; month: string };
  previousTransactions: AnalysisTransaction[];
}) {
  const currentCurrencyScope = buildCurrencyScope(currentTransactions, primaryCurrency);
  const previousCurrencyScope = buildCurrencyScope(previousTransactions, primaryCurrency);
  const scopedCurrentTransactions = filterCurrency(currentTransactions, primaryCurrency, (transaction) => transaction.currency);
  const scopedPreviousTransactions = filterCurrency(previousTransactions, primaryCurrency, (transaction) => transaction.currency);
  const metrics = buildMonthMetrics({
    period: currentPeriod,
    transactions: scopedCurrentTransactions,
    currency: primaryCurrency,
    currencyScope: currentCurrencyScope,
  });
  const previousMonthMetrics = buildMonthMetrics({
    period: previousPeriod,
    transactions: scopedPreviousTransactions,
    currency: primaryCurrency,
    currencyScope: previousCurrencyScope,
  });
  const comparison = buildMonthlyComparison(metrics, previousMonthMetrics);
  const expenseTransactions = scopedCurrentTransactions.filter((tx) => tx.type === TransactionType.EXPENSE);
  const topExpenses = [...expenseTransactions]
    .sort((a, b) => toFiniteNumber(b.amount) - toFiniteNumber(a.amount))
    .slice(0, 8)
    .map((tx) => ({
      date: tx.occurredAt.toISOString().slice(0, 10),
      amount: toFiniteNumber(tx.amount),
      currency: tx.currency,
      category: tx.category?.name ?? "Sin categoría",
      account: tx.account.name,
      description: normalizeDescription(tx.description),
    }));

  return {
    month: currentPeriod.month,
    currency: primaryCurrency,
    currencyScope: currentCurrencyScope,
    transactionCount: scopedCurrentTransactions.length,
    summary: {
      totalIncome: metrics.income,
      totalExpenses: metrics.expenses,
      balance: metrics.balance,
      expensesByCategory: metrics.expensesByCategory,
      expensesByAccount: metrics.expensesByAccount,
    },
    metrics,
    previousMonth: {
      month: previousMonthMetrics.month,
      hasData: previousMonthMetrics.hasData,
      metrics: previousMonthMetrics,
    },
    previousMonthMetrics,
    comparison,
    signals: {
      topExpenses,
      possibleRecurringExpenses: detectRecurringExpenses(expenseTransactions),
      possibleDuplicateExpenses: detectDuplicateExpenses(expenseTransactions),
      highImpactTransactions: metrics.highImpactTransactions,
      repeatedSmallExpenses: metrics.repeatedSmallExpenses,
    },
  };
}

function buildCurrencyScope(transactions: AnalysisTransaction[], primaryCurrency: string) {
  const totalsByCurrency = sumByCurrency(
    transactions,
    (transaction) => transaction.currency,
    (transaction) => transaction.amount,
  );

  return {
    primaryCurrency,
    totalsByCurrency,
    ignoredCurrencies: totalsByCurrency
      .filter((total) => total.currency !== primaryCurrency && total.count > 0)
      .map((total) => total.currency),
    mixedCurrencies: totalsByCurrency.filter((total) => total.count > 0).length > 1,
  };
}

function buildMonthMetrics({
  period,
  transactions,
  currency,
  currencyScope,
}: {
  period: { year: number; monthNumber: number; month: string };
  transactions: AnalysisTransaction[];
  currency: string;
  currencyScope: AiFinancialAnalysisMetrics["currencyScope"];
}): AiFinancialAnalysisMetrics {
  const incomeTransactions = transactions.filter((tx) => tx.type === TransactionType.INCOME);
  const expenseTransactions = transactions.filter((tx) => tx.type === TransactionType.EXPENSE);
  const totalIncome = sumAmounts(incomeTransactions);
  const totalExpenses = sumAmounts(expenseTransactions);
  const balance = totalIncome - totalExpenses;
  const expensesByCategory = groupExpenses(expenseTransactions, "category");
  const expensesByAccount = groupExpenses(expenseTransactions, "account");
  const fixedExpenseTotal = sumAmounts(expenseTransactions.filter(isFixedExpense));
  const mobilityTransactions = expenseTransactions.filter((tx) =>
    matchesAnyCategory(tx.category?.name, MOBILITY_CATEGORY_NAMES),
  );
  const mobilityTotal = sumAmounts(mobilityTransactions);
  const creditCardExpenseTotal = sumAmounts(expenseTransactions.filter(isCreditCardExpense));
  const daysElapsed = getElapsedDaysInMonth(period.year, period.monthNumber);
  const dailyAverageExpense = roundMoney(totalExpenses / daysElapsed);
  const daysInMonth = new Date(period.year, period.monthNumber, 0).getDate();

  return {
    month: period.month,
    currency,
    currencyScope,
    hasData: transactions.length > 0,
    income: totalIncome,
    expenses: totalExpenses,
    balance,
    savingsRate: percentage(balance, totalIncome),
    fixedExpenseRate: percentage(fixedExpenseTotal, totalIncome),
    dailyAverageExpense,
    projectedMonthEndExpense: roundMoney(dailyAverageExpense * daysInMonth),
    expensesByCategory,
    expensesByAccount,
    categoryExpensePercentages: expensesByCategory.map((category) => ({
      name: category.name,
      total: category.total,
      percentage: percentage(category.total, totalExpenses),
    })),
    mobilityTotal,
    mobilityRate: percentage(mobilityTotal, totalIncome),
    highImpactTransactions: getHighImpactTransactions(expenseTransactions, totalIncome),
    repeatedSmallExpenses: getRepeatedSmallExpenses(expenseTransactions, totalIncome),
    creditCardExpenseRate: percentage(creditCardExpenseTotal, totalExpenses),
  };
}

function buildMonthlyComparison(
  current: AiFinancialAnalysisMetrics,
  previous: AiFinancialAnalysisMetrics,
): AiFinancialAnalysisComparison {
  const available = previous.hasData;

  return {
    available,
    currentMonth: current.month,
    previousMonth: previous.month,
    incomeChangeAmount: available ? roundMoney(current.income - previous.income) : 0,
    incomeChangePercent: available ? percentChange(current.income, previous.income) : null,
    expenseChangeAmount: available ? roundMoney(current.expenses - previous.expenses) : 0,
    expenseChangePercent: available ? percentChange(current.expenses, previous.expenses) : null,
    balanceChangeAmount: available ? roundMoney(current.balance - previous.balance) : 0,
    balanceChangePercent: available ? percentChange(current.balance, previous.balance) : null,
    savingsRateChange: available ? roundPercent(current.savingsRate - previous.savingsRate) : 0,
    fixedExpenseRateChange: available ? roundPercent(current.fixedExpenseRate - previous.fixedExpenseRate) : 0,
    mobilityChangeAmount: available ? roundMoney(current.mobilityTotal - previous.mobilityTotal) : 0,
    mobilityChangePercent: available ? percentChange(current.mobilityTotal, previous.mobilityTotal) : null,
    creditCardRateChange: available ? roundPercent(current.creditCardExpenseRate - previous.creditCardExpenseRate) : 0,
    categoryChanges: available ? buildCategoryChanges(current, previous) : [],
  };
}

function buildCategoryChanges(
  current: AiFinancialAnalysisMetrics,
  previous: AiFinancialAnalysisMetrics,
) {
  const currentTotals = new Map(current.expensesByCategory.map((category) => [category.name, category.total]));
  const previousTotals = new Map(previous.expensesByCategory.map((category) => [category.name, category.total]));
  const categoryNames = Array.from(new Set([...currentTotals.keys(), ...previousTotals.keys()])).sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  return categoryNames.map((category) => {
    const currentAmount = currentTotals.get(category) ?? 0;
    const previousAmount = previousTotals.get(category) ?? 0;

    return {
      category,
      currentAmount,
      previousAmount,
      changeAmount: roundMoney(currentAmount - previousAmount),
      changePercent: percentChange(currentAmount, previousAmount),
    };
  });
}

function sumAmounts(transactions: AnalysisTransaction[]) {
  return roundMoney(transactions.reduce((total, tx) => total + toFiniteNumber(tx.amount), 0));
}

function groupExpenses(transactions: AnalysisTransaction[], groupBy: "category" | "account") {
  const totals = new Map<string, { name: string; total: number; count: number }>();

  transactions.forEach((tx) => {
    const name = groupBy === "category" ? tx.category?.name ?? "Sin categoría" : tx.account.name;
    const current = totals.get(name) ?? { name, total: 0, count: 0 };
    current.total += toFiniteNumber(tx.amount);
    current.count += 1;
    totals.set(name, current);
  });

  return Array.from(totals.values())
    .map((item) => ({ ...item, total: roundMoney(item.total) }))
    .sort((a, b) => b.total - a.total);
}

function detectRecurringExpenses(transactions: AnalysisTransaction[]) {
  // Map key: space-collapsed merchant + category + amount bucket so that
  // "BUEN LIBRO" and "BUENLIBRO" fall into the same bucket.
  const groups = new Map<string, { canonical: string; items: AnalysisTransaction[] }>();

  transactions.forEach((tx) => {
    const merchantKey = normalizeMerchant(tx.description);
    const canonical = merchantKey.length >= 4 ? merchantKey : normalizeDescription(tx.description).toUpperCase();
    if (!canonical) return;

    const amountBucket = Math.round(toFiniteNumber(tx.amount) / 100) * 100;
    const key = `${toGroupingKey(canonical)}|${tx.category?.name ?? "Sin categoría"}|${amountBucket}`;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(tx);
      // Prefer the canonical that contains spaces (more human-readable).
      if (!existing.canonical.includes(" ") && canonical.includes(" ")) {
        existing.canonical = canonical;
      }
    } else {
      groups.set(key, { canonical, items: [tx] });
    }
  });

  return Array.from(groups.values())
    .filter(({ items }) => items.length >= 2)
    .map(({ canonical, items }) => ({
      description: toDisplayName(canonical) || normalizeDescription(items[0]?.description),
      category: items[0]?.category?.name ?? "Sin categoría",
      count: items.length,
      averageAmount: roundMoney(sumAmounts(items) / items.length),
      dates: items.map((tx) => tx.occurredAt.toISOString().slice(0, 10)),
    }))
    .slice(0, 8);
}

function detectDuplicateExpenses(transactions: AnalysisTransaction[]) {
  const groups = new Map<string, AnalysisTransaction[]>();

  transactions.forEach((tx) => {
    const description = normalizeDescription(tx.description).toLowerCase();
    const occurredDate = tx.occurredAt.toISOString().slice(0, 10);
    const key = [
      occurredDate,
      toFiniteNumber(tx.amount).toFixed(2),
      tx.account.name,
      tx.category?.name ?? "Sin categoría",
      description,
    ].join("|");
    groups.set(key, [...(groups.get(key) ?? []), tx]);
  });

  return Array.from(groups.values())
    .filter((items) => items.length > 1)
    .map((items) => ({
      date: items[0]?.occurredAt.toISOString().slice(0, 10),
      amount: roundMoney(toFiniteNumber(items[0]?.amount ?? 0)),
      account: items[0]?.account.name ?? "Sin cuenta",
      category: items[0]?.category?.name ?? "Sin categoría",
      description: normalizeDescription(items[0]?.description),
      count: items.length,
    }))
    .slice(0, 8);
}

function isFixedExpense(transaction: AnalysisTransaction) {
  return transaction.expenseType === "FIXED" || matchesAnyCategory(transaction.category?.name, FIXED_CATEGORY_NAMES);
}

function isCreditCardExpense(transaction: AnalysisTransaction) {
  return transaction.paymentMethod === PaymentMethod.CREDIT || transaction.account.type === AccountType.CREDIT_CARD;
}

function getHighImpactTransactions(transactions: AnalysisTransaction[], totalIncome: number) {
  if (totalIncome <= 0) return [];

  const threshold = totalIncome * (HIGH_IMPACT_INCOME_RATE / 100);

  return transactions
    .filter((tx) => toFiniteNumber(tx.amount) > threshold)
    .sort((a, b) => toFiniteNumber(b.amount) - toFiniteNumber(a.amount))
    .slice(0, 8)
    .map((tx) => ({
      date: tx.occurredAt.toISOString().slice(0, 10),
      amount: toFiniteNumber(tx.amount),
      currency: tx.currency,
      incomePercentage: percentage(toFiniteNumber(tx.amount), totalIncome),
      category: tx.category?.name ?? "Sin categoría",
      account: tx.account.name,
      description: normalizeDescription(tx.description),
    }));
}

function isEssentialTransaction(tx: AnalysisTransaction): boolean {
  if (matchesAnyCategory(tx.category?.name, ESSENTIAL_CATEGORY_NAMES)) return true;
  const desc = normalizeRepeatedDescription(tx.description).toLowerCase();
  return ESSENTIAL_DESCRIPTION_FRAGMENTS.some((fragment) => desc.includes(fragment));
}

function getRepeatedSmallExpenses(transactions: AnalysisTransaction[], totalIncome: number) {
  const largeExpenseThreshold = totalIncome > 0 ? totalIncome * (HIGH_IMPACT_INCOME_RATE / 100) : Number.POSITIVE_INFINITY;
  // Map key: space-collapsed canonical so "BUEN LIBRO" and "BUENLIBRO" merge.
  const groups = new Map<string, { canonical: string; items: AnalysisTransaction[] }>();

  transactions.forEach((tx) => {
    if (toFiniteNumber(tx.amount) > largeExpenseThreshold) return;
    // Essential purchases (supermarkets, pharmacies, services) are never "invisible expenses"
    if (isEssentialTransaction(tx)) return;

    const merchantKey = normalizeMerchant(tx.description);
    const canonical = merchantKey.length >= 4 ? merchantKey : normalizeRepeatedDescription(tx.description);
    if (!canonical) return;

    const key = toGroupingKey(canonical);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(tx);
      // Prefer canonical with spaces (more human-readable).
      if (!existing.canonical.includes(" ") && canonical.includes(" ")) {
        existing.canonical = canonical;
      }
    } else {
      groups.set(key, { canonical, items: [tx] });
    }
  });

  return Array.from(groups.values())
    .filter(({ items }) => items.length >= 2)
    .map(({ canonical, items }) => {
      const total = sumAmounts(items);
      const categories = Array.from(
        new Set(items.map((tx) => tx.category?.name ?? "Sin categoría")),
      ).slice(0, 4);

      return {
        // Use canonical display name — never the raw description of an arbitrary first item.
        description: toDisplayName(canonical) || normalizeDescription(items[0]?.description),
        normalizedDescription: canonical,
        count: items.length,
        total,
        averageAmount: roundMoney(total / items.length),
        categories,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

async function requestOpenAiAnalysis(
  input: ReturnType<typeof buildCompactMonthlyInput>,
  usage: { userId: string; endpoint: string },
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    traceAi("OPENAI_MONTHLY_MISSING_KEY");
    throw new ApiError(503, "El servicio de IA no está configurado.");
  }
  const model = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
  const prompt = `Analizá este resumen mensual compacto y generá el análisis solicitado.\nRecordatorio de escala: el campo "score" es un entero 0-100 (0=crítico, 50=equilibrio, 100=óptimo).\nGuardrail multi-moneda: el campo currency es la moneda real analizada. currencyScope.ignoredCurrencies lista monedas presentes que NO fueron sumadas. No infieras totales globales ni mezcles monedas.\nDatos:\n${JSON.stringify(input)}`;

  let response: Response;
  try {
    traceAi("OPENAI_MONTHLY_FETCH_START", { model, user: traceUserId(usage.userId) });
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: buildMonthlySystemPrompt(),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "monthly_financial_analysis",
            strict: true,
            schema: analysisSchema,
          },
        },
      }),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new ApiError(504, "El análisis tardó demasiado. Intentá nuevamente.");
    }
    throw err;
  }

  if (!response.ok) {
    traceAi("OPENAI_MONTHLY_FETCH_ERROR", { model, status: response.status, user: traceUserId(usage.userId) });
    const apiError = await readOpenAiError(response);
    captureServerMessage("Monthly AI provider error", "ai", {
      status: response.status,
      mappedStatus: apiError.status,
    });
    throw new ApiError(apiError.status, apiError.message);
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: unknown;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const outputText = payload.output_text ?? extractResponsesText(payload.output);
  traceAi("OPENAI_MONTHLY_FETCH_OK", {
    model,
    hasOutput: Boolean(outputText),
    user: traceUserId(usage.userId),
  });

  if (!outputText) {
    throw new ApiError(502, "La IA no devolvió un resultado válido.");
  }

  let result: AiFinancialAnalysisResult;
  try {
    result = normalizeAnalysisResult(JSON.parse(outputText) as AiFinancialAnalysisResult);
  } catch {
    throw new ApiError(502, "La IA devolvió un JSON inválido.");
  }

  traceAi("AI_MONTHLY_USAGE_WRITE_START", { user: traceUserId(usage.userId), endpoint: usage.endpoint });
  await recordAiUsage({
    userId: usage.userId,
    endpoint: usage.endpoint,
    model,
    inputTokens: payload.usage?.input_tokens ?? estimateTextTokens(prompt),
    outputTokens: payload.usage?.output_tokens ?? estimateTextTokens(outputText),
  });
  traceAi("AI_MONTHLY_USAGE_WRITE_OK", { user: traceUserId(usage.userId), endpoint: usage.endpoint });

  return result;
}

function extractResponsesText(output: unknown) {
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (content && typeof content === "object" && "text" in content && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return null;
}

async function readOpenAiError(response: Response) {
  const fallback = {
    status: 502,
    message: "No se pudo generar el análisis con IA.",
  };

  try {
    const payload = (await response.json()) as {
      error?: {
        code?: string | null;
        message?: string;
        type?: string;
      };
    };
    const code = payload.error?.code;

    if (code === "insufficient_quota") {
      return {
        status: 402,
        message: "El servicio de IA alcanzó su límite de uso.",
      };
    }

    if (code === "invalid_api_key") {
      return {
        status: 503,
        message: "El servicio de IA no está disponible.",
      };
    }

    if (response.status === 429) {
      return {
        status: 429,
        message: "OpenAI está limitando las solicitudes. Probá nuevamente en unos minutos.",
      };
    }

    return fallback;
  } catch {
    return fallback;
  }
}

function normalizeAnalysisResult(result: AiFinancialAnalysisResult): AiFinancialAnalysisResult {
  return {
    summary: String(result.summary ?? ""),
    score: clamp(Number(result.score), 0, 100),
    positivePoints: Array.isArray(result.positivePoints) ? result.positivePoints.slice(0, 5) : [],
    alerts: Array.isArray(result.alerts) ? result.alerts.slice(0, 5) : [],
    recommendations: Array.isArray(result.recommendations) ? result.recommendations.slice(0, 5) : [],
    riskPoints: Array.isArray(result.riskPoints) ? result.riskPoints.slice(0, 5) : [],
  };
}

function hashJson(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buildInputHash({
  month,
  previousMonth,
  currency,
  transactions,
  previousTransactions,
}: {
  month: string;
  previousMonth: string;
  currency: string;
  transactions: AnalysisTransaction[];
  previousTransactions: AnalysisTransaction[];
}) {
  return hashJson({
    month,
    previousMonth,
    currency,
    transactions: serializeTransactionsForHash(transactions),
    previousTransactions: serializeTransactionsForHash(previousTransactions),
  });
}

function serializeTransactionsForHash(transactions: AnalysisTransaction[]) {
  return transactions.map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    currency: transaction.currency,
    amount: transaction.amount.toString(),
    description: transaction.description,
    expenseType: transaction.expenseType,
    paymentMethod: transaction.paymentMethod,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    occurredAt: transaction.occurredAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
    deletedAt: transaction.deletedAt?.toISOString() ?? null,
  }));
}

function getPreviousMonthPeriod(year: number, monthNumber: number) {
  const previousYear = monthNumber === 1 ? year - 1 : year;
  const previousMonthNumber = monthNumber === 1 ? 12 : monthNumber - 1;

  return {
    year: previousYear,
    monthNumber: previousMonthNumber,
    month: formatMonth(previousYear, previousMonthNumber),
  };
}

function formatMonth(year: number, monthNumber: number) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

function normalizeDescription(description: string | null | undefined) {
  return description?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "";
}

function normalizeRepeatedDescription(description: string | null | undefined) {
  const normalized = description
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\d+/g, "")
    .replace(/[^A-Z* ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized && normalized.length >= 3 ? normalized.slice(0, 80) : "";
}

function normalizeCategoryName(name: string | null | undefined) {
  return name
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() ?? "";
}

function matchesAnyCategory(categoryName: string | null | undefined, candidates: readonly string[]) {
  const normalizedCategory = normalizeCategoryName(categoryName);
  if (!normalizedCategory) return false;

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeCategoryName(candidate);
    return normalizedCategory.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedCategory);
  });
}

function getElapsedDaysInMonth(year: number, monthNumber: number) {
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const [currentYear, currentMonth, currentDay] = formatArgentinaDateInput().split("-").map(Number);

  if (year === currentYear && monthNumber === currentMonth) {
    return clamp(currentDay, 1, daysInMonth);
  }

  if (year < currentYear || (year === currentYear && monthNumber < currentMonth)) {
    return daysInMonth;
  }

  return 1;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return roundPercent((numerator / denominator) * 100);
}

function percentChange(current: number, previous: number) {
  // A previous value of zero makes percentage variation undefined.
  // We return null instead of 100 to avoid implying a bounded increase from no baseline.
  if (previous === 0) return null;

  return roundPercent(((current - previous) / Math.abs(previous)) * 100);
}

function roundPercent(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
