/**
 * Layer 3 — AI narrative generation (very cheap).
 * The AI only receives pre-computed metrics + signals — never raw transactions.
 * Target: ~350–450 tokens in, ~120–180 tokens out per call.
 */

import type { Signal } from "./financial-signals";
import { captureServerMessage } from "@/lib/observability/server";
import { estimateTextTokens, recordAiUsage } from "@/server/services/ai-usage";
import { traceAi, traceUserId } from "@/server/services/ai-trace";
import { buildWeeklySystemPrompt } from "@/lib/ai/prompt-governance";

export interface ReflectionInput {
  weekLabel: string;          // e.g. "5 al 11 de mayo"
  totalExpenses: number;
  totalIncome: number;
  savingsRate: number;
  topCategory: string | null;
  weekendPct: number;
  expensesChange: number | null;  // % vs previous week
  signals: Array<{ label: string; severity: Signal["severity"] }>;
  usage?: { userId: string; endpoint: string };
}

export interface ReflectionInsight {
  text: string;
  tone: "positive" | "neutral" | "warning";
}

export interface ReflectionResult {
  insights: ReflectionInsight[];
}

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4o-mini";

const REFLECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["insights"],
  properties: {
    insights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "tone"],
        properties: {
          text: { type: "string" },
          tone: { type: "string", enum: ["positive", "neutral", "warning"] },
        },
      },
    },
  },
} as const;

function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Builds the user-content data block sent to OpenAI. Target: ≤ 300 tokens. */
function buildWeeklyDataBlock(input: ReflectionInput): string {
  const lines: string[] = ["Datos de la semana:"];

  lines.push(`Semana: ${input.weekLabel}`);
  lines.push(`Movimiento semanal: ${formatARS(input.totalExpenses)} en gastos`);

  if (input.totalIncome > 0) {
    lines.push(`Ingresos registrados esta semana: ${formatARS(input.totalIncome)}`);
  }

  if (input.topCategory) {
    lines.push(`Categoría con más actividad: ${input.topCategory}`);
  }

  if (input.weekendPct > 15) {
    lines.push(`Fin de semana: ${Math.round(input.weekendPct)}% del movimiento total`);
  }

  if (input.expensesChange !== null && Math.abs(input.expensesChange) >= 5) {
    const dir = input.expensesChange > 0 ? "↑" : "↓";
    lines.push(`Vs semana anterior: flujo ${dir} ${Math.abs(Math.round(input.expensesChange))}%`);
  }

  if (input.signals.length > 0) {
    lines.push(`Señales backend: ${input.signals.map((s) => s.label).join(" | ")}`);
  }

  return lines.join("\n");
}

export async function generateWeeklyReflection(
  input: ReflectionInput,
): Promise<ReflectionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    traceAi("OPENAI_WEEKLY_MISSING_KEY");
    throw new Error("El servicio de IA no está configurado.");
  }

  const dataBlock = buildWeeklyDataBlock(input);
  const systemPrompt = buildWeeklySystemPrompt();
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  traceAi("OPENAI_WEEKLY_FETCH_START", {
    model,
    user: input.usage ? traceUserId(input.usage.userId) : undefined,
  });

  let response: Response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: dataBlock },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "weekly_reflection",
            strict: true,
            schema: REFLECTION_SCHEMA,
          },
        },
      }),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error("El análisis tardó demasiado. Intentá nuevamente.");
    }
    throw err;
  }

  if (!response.ok) {
    traceAi("OPENAI_WEEKLY_FETCH_ERROR", { model, status: response.status });
    captureServerMessage("Weekly reflection provider error", "ai", {
      status: response.status,
    });
    throw new Error("No pudimos completar el análisis esta vez.");
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: unknown;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const outputText = payload.output_text ?? extractText(payload.output);
  traceAi("OPENAI_WEEKLY_FETCH_OK", {
    model,
    hasOutput: Boolean(outputText),
    user: input.usage ? traceUserId(input.usage.userId) : undefined,
  });

  if (!outputText) {
    throw new Error("La IA no devolvió resultado válido.");
  }

  const parsed = JSON.parse(outputText) as ReflectionResult;
  if (input.usage) {
    traceAi("AI_WEEKLY_USAGE_WRITE_START", {
      user: traceUserId(input.usage.userId),
      endpoint: input.usage.endpoint,
    });
    await recordAiUsage({
      userId: input.usage.userId,
      endpoint: input.usage.endpoint,
      model,
      inputTokens: payload.usage?.input_tokens ?? estimateTextTokens(systemPrompt + dataBlock),
      outputTokens: payload.usage?.output_tokens ?? estimateTextTokens(outputText),
    });
    traceAi("AI_WEEKLY_USAGE_WRITE_OK", {
      user: traceUserId(input.usage.userId),
      endpoint: input.usage.endpoint,
    });
  }
  // Clamp to 3 insights
  return { insights: parsed.insights.slice(0, 3) };
}

function extractText(output: unknown): string | null {
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const c of item.content) {
      if (c && typeof c === "object" && "text" in c && typeof c.text === "string") return c.text;
    }
  }
  return null;
}
