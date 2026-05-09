import { createHash } from "node:crypto";
import { Prisma, TransactionStatus, TransactionType } from "@prisma/client";
import { argentinaMonthRangeUtc } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/errors";
import { toFiniteNumber } from "./financial-ledger";
import { assertHouseholdAccess } from "./households";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

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

  const { year, monthNumber } = parseMonth(month);
  const { start, end } = argentinaMonthRangeUtc(year, monthNumber);

  const transactions = await prisma.transaction.findMany({
    where: {
      householdId,
      deletedAt: null,
      status: { not: TransactionStatus.CANCELED },
      type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
      occurredAt: { gte: start, lt: end },
    },
    include: analysisTransactionInclude,
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
  });

  const compactInput = buildCompactMonthlyInput({ month, transactions });
  const inputHash = hashJson({
    month,
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      currency: transaction.currency,
      amount: transaction.amount.toString(),
      description: transaction.description,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      occurredAt: transaction.occurredAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
      deletedAt: transaction.deletedAt?.toISOString() ?? null,
    })),
  });

  const existing = await prisma.aiFinancialAnalysis.findUnique({
    where: { userId_month: { userId: userProfileId, month } },
  });

  if (existing?.inputHash === inputHash) {
    return {
      analysis: existing.result as AiFinancialAnalysisResult,
      cached: true,
      month,
      generatedAt: existing.updatedAt.toISOString(),
    };
  }

  const analysis = await requestOpenAiAnalysis(compactInput);

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

  return {
    analysis: saved.result as AiFinancialAnalysisResult,
    cached: false,
    month,
    generatedAt: saved.updatedAt.toISOString(),
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

function buildCompactMonthlyInput({
  month,
  transactions,
}: {
  month: string;
  transactions: AnalysisTransaction[];
}) {
  const incomeTransactions = transactions.filter((tx) => tx.type === TransactionType.INCOME);
  const expenseTransactions = transactions.filter((tx) => tx.type === TransactionType.EXPENSE);
  const totalIncome = sumAmounts(incomeTransactions);
  const totalExpenses = sumAmounts(expenseTransactions);
  const expensesByCategory = groupExpenses(expenseTransactions, "category");
  const expensesByAccount = groupExpenses(expenseTransactions, "account");
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
    month,
    currency: "ARS",
    transactionCount: transactions.length,
    summary: {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      expensesByCategory,
      expensesByAccount,
    },
    signals: {
      topExpenses,
      possibleRecurringExpenses: detectRecurringExpenses(expenseTransactions),
      possibleDuplicateExpenses: detectDuplicateExpenses(expenseTransactions),
    },
  };
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
  const groups = new Map<string, AnalysisTransaction[]>();

  transactions.forEach((tx) => {
    const description = normalizeDescription(tx.description);
    if (!description) return;

    const amountBucket = Math.round(toFiniteNumber(tx.amount) / 100) * 100;
    const key = `${description.toLowerCase()}|${tx.category?.name ?? "Sin categoría"}|${amountBucket}`;
    groups.set(key, [...(groups.get(key) ?? []), tx]);
  });

  return Array.from(groups.values())
    .filter((items) => items.length >= 2)
    .map((items) => ({
      description: normalizeDescription(items[0]?.description),
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

async function requestOpenAiAnalysis(input: ReturnType<typeof buildCompactMonthlyInput>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ApiError(503, "OPENAI_API_KEY no está configurada.");
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
      input: [
        {
          role: "system",
          content:
            "Sos un analista financiero para una app de finanzas personales en Argentina. Respondé en español rioplatense, con tono claro, prudente y accionable. No inventes datos. No des asesoramiento financiero regulado; basate solo en el resumen recibido.",
        },
        {
          role: "user",
          content: `Analizá este resumen mensual compacto y devolvé solo el JSON solicitado:\n${JSON.stringify(input)}`,
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

  if (!response.ok) {
    const message = await response.text();
    console.error("OpenAI analysis error:", message);
    throw new ApiError(502, "No se pudo generar el análisis con IA.");
  }

  const payload = (await response.json()) as { output_text?: string; output?: unknown };
  const outputText = payload.output_text ?? extractResponsesText(payload.output);

  if (!outputText) {
    throw new ApiError(502, "La IA no devolvió un resultado válido.");
  }

  try {
    return normalizeAnalysisResult(JSON.parse(outputText) as AiFinancialAnalysisResult);
  } catch {
    throw new ApiError(502, "La IA devolvió un JSON inválido.");
  }
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

function normalizeDescription(description: string | null | undefined) {
  return description?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "";
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
