import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/errors";
import { buildCopilotSystemPrompt } from "@/lib/ai/prompt-governance";
import { classifyIntent } from "@/lib/ai/copilot-intent";
import { assertAiQuota, estimateTextTokens, recordAiUsage } from "@/server/services/ai-usage";
import { traceAi, traceUserId } from "@/server/services/ai-trace";
import { buildCopilotContext, type CopilotFinancialContext } from "@/server/services/copilot-context";
import { assertHouseholdAccess } from "@/server/services/households";
import { argentinaMonthKey } from "@/lib/dates";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1-mini";
const REJECT_MESSAGE = "Solo puedo ayudarte con información financiera basada en tus datos de Meridian.";
const HISTORY_TURNS = 3;

export type CopilotQueryResult = {
  answer: string;
  dataUsed: string;
  periodAnalyzed: string;
  hasEnoughData: boolean;
  suggestedFollowUps: string[];
  intent: string;
  cached: boolean;
};

const copilotResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "dataUsed", "periodAnalyzed", "hasEnoughData", "suggestedFollowUps"],
  properties: {
    answer: { type: "string" },
    dataUsed: { type: "string" },
    periodAnalyzed: { type: "string" },
    hasEnoughData: { type: "boolean" },
    suggestedFollowUps: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
    },
  },
} as const;

export async function runCopilotQuery({
  userProfileId,
  householdId,
  message,
}: {
  userProfileId: string;
  householdId: string;
  message: string;
}): Promise<CopilotQueryResult> {
  await assertHouseholdAccess(userProfileId, householdId);

  const { intent } = classifyIntent(message);

  // REJECT sin costo — respuesta inmediata
  if (intent === "REJECT") {
    await saveMessage(userProfileId, householdId, "user", message, intent, 0, 0);
    await saveMessage(userProfileId, householdId, "assistant", REJECT_MESSAGE, intent, 0, 0);
    return {
      answer: REJECT_MESSAGE,
      dataUsed: "Sin datos — pregunta fuera del scope financiero.",
      periodAnalyzed: "N/A",
      hasEnoughData: false,
      suggestedFollowUps: [
        "¿En qué gasté más este mes?",
        "¿Cómo viene mi ahorro?",
        "¿Qué cambió este mes?",
      ],
      intent,
      cached: false,
    };
  }

  await assertAiQuota(userProfileId, "ai.copilot");

  const currentMonth = argentinaMonthKey(new Date());
  const context = await buildCopilotContext(userProfileId, householdId, currentMonth);
  const history = await loadRecentHistory(userProfileId, householdId, HISTORY_TURNS);

  traceAi("COPILOT_QUERY_START", { user: traceUserId(userProfileId), intent });

  const { answer, inputTokens, outputTokens } = await callOpenAi({
    message,
    context,
    history,
    userId: userProfileId,
  });

  traceAi("COPILOT_QUERY_OK", { user: traceUserId(userProfileId), intent });

  await Promise.all([
    saveMessage(userProfileId, householdId, "user", message, intent, 0, 0),
    saveMessage(userProfileId, householdId, "assistant", answer.answer, intent, inputTokens, outputTokens),
    recordAiUsage({
      userId: userProfileId,
      endpoint: "ai.copilot",
      model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
      inputTokens,
      outputTokens,
    }),
  ]);

  return { ...answer, intent, cached: false };
}

async function callOpenAi({
  message,
  context,
  history,
  userId,
}: {
  message: string;
  context: CopilotFinancialContext;
  history: Array<{ role: string; content: string }>;
  userId: string;
}): Promise<{ answer: CopilotQueryResult; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new ApiError(503, "El servicio de IA no está configurado.");

  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const contextJson = JSON.stringify(context);

  const userPrompt = [
    `Contexto financiero del usuario (datos reales de Meridian):`,
    contextJson,
    "",
    history.length > 0
      ? `Conversación reciente:\n${history.map((h) => `${h.role === "user" ? "Usuario" : "Copilot"}: ${h.content}`).join("\n")}`
      : "",
    "",
    `Pregunta del usuario: "${message}"`,
  ]
    .filter(Boolean)
    .join("\n");

  let response: Response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      signal: AbortSignal.timeout(25_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: buildCopilotSystemPrompt() },
          { role: "user", content: userPrompt },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "copilot_response",
            strict: true,
            schema: copilotResponseSchema,
          },
        },
      }),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new ApiError(504, "El copiloto tardó demasiado. Intentá nuevamente.");
    }
    throw err;
  }

  if (!response.ok) {
    traceAi("COPILOT_OPENAI_ERROR", { status: response.status, user: traceUserId(userId) });
    throw new ApiError(502, "No se pudo procesar tu pregunta. Intentá nuevamente.");
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: unknown;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const outputText = payload.output_text ?? extractText(payload.output);
  if (!outputText) throw new ApiError(502, "La IA no devolvió una respuesta válida.");

  const parsed = JSON.parse(outputText) as {
    answer: string;
    dataUsed: string;
    periodAnalyzed: string;
    hasEnoughData: boolean;
    suggestedFollowUps: string[];
  };

  return {
    answer: {
      answer: parsed.answer,
      dataUsed: parsed.dataUsed,
      periodAnalyzed: parsed.periodAnalyzed,
      hasEnoughData: parsed.hasEnoughData,
      suggestedFollowUps: Array.isArray(parsed.suggestedFollowUps) ? parsed.suggestedFollowUps.slice(0, 3) : [],
      intent: "",
      cached: false,
    },
    inputTokens: payload.usage?.input_tokens ?? estimateTextTokens(userPrompt),
    outputTokens: payload.usage?.output_tokens ?? estimateTextTokens(outputText),
  };
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

async function loadRecentHistory(userProfileId: string, householdId: string, turns: number) {
  const messages = await prisma.aiCopilotMessage.findMany({
    where: { userId: userProfileId, householdId },
    orderBy: { createdAt: "desc" },
    take: turns * 2,
    select: { role: true, content: true },
  });
  return messages.reverse();
}

async function saveMessage(
  userId: string,
  householdId: string,
  role: string,
  content: string,
  intent: string,
  inputTokens: number,
  outputTokens: number,
) {
  await prisma.aiCopilotMessage.create({
    data: { userId, householdId, role, content, intent, inputTokens, outputTokens },
  });
}
