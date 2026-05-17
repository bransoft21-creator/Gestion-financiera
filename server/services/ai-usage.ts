import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/errors";
import { traceAi, traceUserId } from "@/server/services/ai-trace";

const DAILY_AI_CALL_LIMIT = Number(process.env.AI_DAILY_CALL_LIMIT ?? 25);
const MONTHLY_AI_CALL_LIMIT = Number(process.env.AI_MONTHLY_CALL_LIMIT ?? 300);
const DAILY_AI_COST_LIMIT = Number(process.env.AI_DAILY_COST_LIMIT_USD ?? 0.25);
const MONTHLY_AI_COST_LIMIT = Number(process.env.AI_MONTHLY_COST_LIMIT_USD ?? 3);

const ENDPOINT_DAILY_LIMITS: Record<string, number> = {
  "ai.weekly-reflection": Number(process.env.AI_WEEKLY_REFLECTION_DAILY_LIMIT ?? 4),
  "ai.monthly-analysis": Number(process.env.AI_MONTHLY_ANALYSIS_DAILY_LIMIT ?? 6),
  "ai.smart-import": Number(process.env.AI_SMART_IMPORT_DAILY_LIMIT ?? 10),
  "ai.smart-import.mapping": Number(process.env.AI_SMART_IMPORT_MAPPING_DAILY_LIMIT ?? 5),
};

const MODEL_PRICING_USD_PER_TOKEN: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.00000015, output: 0.0000006 },
  "gpt-4.1-mini": { input: 0.0000004, output: 0.0000016 },
  "gpt-4.1-nano": { input: 0.0000001, output: 0.0000004 },
};

export async function assertAiQuota(userId: string, endpoint: string) {
  traceAi("AI_QUOTA_START", { endpoint, user: traceUserId(userId) });

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [day, month, endpointDay] = await Promise.all([
    aggregateUsage(userId, dayStart),
    aggregateUsage(userId, monthStart),
    aggregateUsage(userId, dayStart, endpoint),
  ]);

  const endpointLimit = ENDPOINT_DAILY_LIMITS[endpoint] ?? DAILY_AI_CALL_LIMIT;

  traceAi("AI_QUOTA_COUNTS", {
    endpoint,
    user: traceUserId(userId),
    dayCalls: day.calls,
    monthCalls: month.calls,
    endpointDayCalls: endpointDay.calls,
    dayCost: day.cost,
    monthCost: month.cost,
    endpointLimit,
  });

  if (endpointDay.calls >= endpointLimit) {
    traceAi("AI_QUOTA_BLOCKED_ENDPOINT", { endpoint, user: traceUserId(userId), endpointLimit });
    throw new ApiError(429, "Llegaste al límite diario para esta función de IA. Probá mañana.");
  }
  if (day.calls >= DAILY_AI_CALL_LIMIT || day.cost >= DAILY_AI_COST_LIMIT) {
    traceAi("AI_QUOTA_BLOCKED_DAILY", { endpoint, user: traceUserId(userId) });
    throw new ApiError(429, "Llegaste al límite diario de IA. Probá mañana.");
  }
  if (month.calls >= MONTHLY_AI_CALL_LIMIT || month.cost >= MONTHLY_AI_COST_LIMIT) {
    traceAi("AI_QUOTA_BLOCKED_MONTHLY", { endpoint, user: traceUserId(userId) });
    throw new ApiError(429, "Llegaste al límite mensual de IA.");
  }

  traceAi("AI_QUOTA_OK", { endpoint, user: traceUserId(userId) });
}

export async function recordAiUsage(input: {
  userId: string;
  endpoint: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}) {
  traceAi("AI_USAGE_CREATE_START", {
    endpoint: input.endpoint,
    model: input.model,
    user: traceUserId(input.userId),
  });

  const inputTokens = Math.max(0, Math.round(input.inputTokens ?? 0));
  const outputTokens = Math.max(0, Math.round(input.outputTokens ?? 0));

  const usage = await prisma.aiUsage.create({
    data: {
      userId: input.userId,
      endpoint: input.endpoint,
      model: input.model,
      inputTokens,
      outputTokens,
      estimatedCost: estimateAiCost(input.model, inputTokens, outputTokens),
    },
  });

  traceAi("AI_USAGE_CREATED", {
    endpoint: input.endpoint,
    model: input.model,
    user: traceUserId(input.userId),
    usageId: usage.id,
    inputTokens,
    outputTokens,
  });
}

export function estimateTextTokens(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return Math.ceil((text?.length ?? 0) / 4);
}

export function estimateAiCost(model: string, inputTokens: number, outputTokens: number) {
  const pricing = MODEL_PRICING_USD_PER_TOKEN[model] ?? MODEL_PRICING_USD_PER_TOKEN["gpt-4o-mini"];
  return new Prisma.Decimal(
    inputTokens * pricing.input + outputTokens * pricing.output,
  ).toDecimalPlaces(6);
}

async function aggregateUsage(userId: string, since: Date, endpoint?: string) {
  const result = await prisma.aiUsage.aggregate({
    where: {
      userId,
      endpoint,
      createdAt: { gte: since },
    },
    _count: { _all: true },
    _sum: { estimatedCost: true },
  });

  return {
    calls: result._count._all,
    cost: Number(result._sum.estimatedCost ?? 0),
  };
}
