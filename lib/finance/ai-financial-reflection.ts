/**
 * Layer 3 — AI narrative generation (very cheap).
 * The AI only receives pre-computed metrics + signals — never raw transactions.
 * Target: ~350–450 tokens in, ~120–180 tokens out per call.
 */

import type { Signal } from "./financial-signals";

export interface ReflectionInput {
  weekLabel: string;          // e.g. "5 al 11 de mayo"
  totalExpenses: number;
  totalIncome: number;
  savingsRate: number;
  topCategory: string | null;
  weekendPct: number;
  expensesChange: number | null;  // % vs previous week
  signals: Array<{ label: string; severity: Signal["severity"] }>;
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

/** Builds the compact prompt sent to OpenAI. Target: ≤ 450 tokens. */
function buildPrompt(input: ReflectionInput): string {
  const lines: string[] = [];

  lines.push(`Semana: ${input.weekLabel}`);
  lines.push(`Gastos: ${formatARS(input.totalExpenses)}`);

  if (input.totalIncome > 0) {
    lines.push(`Ingresos: ${formatARS(input.totalIncome)} | Ahorro: ${Math.round(input.savingsRate)}%`);
  }

  if (input.topCategory) {
    lines.push(`Categoría top: ${input.topCategory}`);
  }

  if (input.weekendPct > 15) {
    lines.push(`Fin de semana: ${Math.round(input.weekendPct)}% del gasto total`);
  }

  if (input.expensesChange !== null && Math.abs(input.expensesChange) >= 5) {
    const dir = input.expensesChange > 0 ? "↑" : "↓";
    lines.push(`Vs semana anterior: gastos ${dir} ${Math.abs(Math.round(input.expensesChange))}%`);
  }

  if (input.signals.length > 0) {
    lines.push(`Señales: ${input.signals.map((s) => s.label).join(" | ")}`);
  }

  return [
    "Sos un asistente financiero personal para una app en Argentina. Tu tono es calmado, empático y directo.",
    "",
    "Datos de la semana:",
    ...lines,
    "",
    "Generá exactamente 2 o 3 insights breves sobre esta semana. Cada insight:",
    "- text: oración corta (máx 15 palabras), en español rioplatense, dirigida al usuario",
    '- tone: "positive" si es buena noticia, "warning" si requiere atención, "neutral" si es informativo',
    "",
    "Reglas: no uses tecnicismos, no culpes al usuario, no seas dramático.",
    "Respondé SOLO con el JSON solicitado.",
  ].join("\n");
}

export async function generateWeeklyReflection(
  input: ReflectionInput,
): Promise<ReflectionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no está configurada.");
  }

  const prompt = buildPrompt(input);

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
        model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
        input: prompt,
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
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI error ${response.status}: ${body}`);
  }

  const payload = (await response.json()) as { output_text?: string; output?: unknown };
  const outputText = payload.output_text ?? extractText(payload.output);

  if (!outputText) {
    throw new Error("La IA no devolvió resultado válido.");
  }

  const parsed = JSON.parse(outputText) as ReflectionResult;
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
