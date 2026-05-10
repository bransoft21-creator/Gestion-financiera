import {
  AccountType,
  CurrencyCode,
  ExpenseType,
  PaymentMethod,
  TransactionOrigin,
  TransactionType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/errors";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SmartImportCandidate = {
  id: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  occurredAt: string | null;
  type: TransactionType;
  paymentMethod: PaymentMethod | null;
  expenseType: ExpenseType | null;
  isInstallment: boolean;
  installmentNumber: number | null;
  totalInstallments: number | null;
  origin: TransactionOrigin;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  suggestedAccountId: string | null;
  suggestedAccountName: string | null;
  confidence: number;
  isCharge: boolean;
  isTax: boolean;
  warning: string | null;
  possibleDuplicate: boolean;
  duplicateInfo: { date: string; amount: number; description: string } | null;
};

export type SmartImportResult = {
  candidates: SmartImportCandidate[];
  metadata: {
    sourceType: string;
    currency: CurrencyCode;
    warnings: string[];
    totalDetected: number;
  };
};

type WorkspaceAccount = {
  id: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
};

type WorkspaceCategory = {
  id: string;
  name: string;
  type: string;
};

// ---------------------------------------------------------------------------
// AI raw output shape
// ---------------------------------------------------------------------------

type AiTransaction = {
  description: string;
  amount: number;
  currency: string;
  date: string;
  type: string;
  payment_method: string;
  is_installment: boolean;
  installment_number: number;
  total_installments: number;
  expense_type: string;
  suggested_category: string;
  suggested_account_type: string;
  confidence: number;
  is_charge: boolean;
  is_tax: boolean;
  warning: string;
};

type AiOutput = {
  source_type: string;
  currency: string;
  transactions: AiTransaction[];
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Public service function
// ---------------------------------------------------------------------------

export async function analyzeFile(
  buffer: Buffer,
  mimeType: string,
  workspace: {
    householdId: string;
    accounts: WorkspaceAccount[];
    categories: WorkspaceCategory[];
  },
): Promise<SmartImportResult> {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new ApiError(413, "El archivo es demasiado grande. El máximo es 10 MB.");
  }

  const isImage = SUPPORTED_IMAGE_TYPES.includes(mimeType);
  const isPdf = mimeType === "application/pdf";

  if (!isImage && !isPdf) {
    throw new ApiError(400, "Formato no soportado. Usá JPG, PNG, WEBP o PDF.");
  }

  const raw = isImage
    ? await callVision(buffer, mimeType)
    : await callPdf(buffer);

  return normalizeResult(raw, workspace);
}

// ---------------------------------------------------------------------------
// AI callers
// ---------------------------------------------------------------------------

async function callVision(buffer: Buffer, mimeType: string): Promise<AiOutput> {
  const base64 = buffer.toString("base64");
  return requestOpenAi([
    {
      type: "input_image",
      image_url: `data:${mimeType};base64,${base64}`,
    },
    {
      type: "input_text",
      text: userPrompt(),
    },
  ]);
}

async function callPdf(buffer: Buffer): Promise<AiOutput> {
  const text = await extractPdfText(buffer);
  if (!text.trim()) {
    throw new ApiError(
      422,
      "No se pudo extraer texto del PDF. Intentá con un screenshot o imagen del documento.",
    );
  }
  return requestOpenAi([
    {
      type: "input_text",
      text: `${userPrompt()}\n\nContenido del documento:\n${text}`,
    },
  ]);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // pdf-parse ships CJS; dynamic import handles interop
    const mod = await import("pdf-parse");
    type PdfParseFunc = (buf: Buffer) => Promise<{ text: string }>;
    const pdfParse = ((mod as unknown as { default: unknown }).default ?? mod) as PdfParseFunc;
    const data = await pdfParse(buffer);
    return (data.text ?? "").slice(0, 12_000);
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// OpenAI Responses API
// ---------------------------------------------------------------------------

const aiSchema = {
  type: "object",
  additionalProperties: false,
  required: ["source_type", "currency", "transactions", "warnings"],
  properties: {
    source_type: {
      type: "string",
      enum: ["CARD_SUMMARY", "BANK", "MERCADO_PAGO", "TICKET", "RECEIPT", "UNKNOWN"],
    },
    currency: { type: "string", enum: ["ARS", "USD"] },
    transactions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "description",
          "amount",
          "currency",
          "date",
          "type",
          "payment_method",
          "is_installment",
          "installment_number",
          "total_installments",
          "expense_type",
          "suggested_category",
          "suggested_account_type",
          "confidence",
          "is_charge",
          "is_tax",
          "warning",
        ],
        properties: {
          description: { type: "string" },
          amount: { type: "number" },
          currency: { type: "string", enum: ["ARS", "USD"] },
          date: { type: "string" },
          type: { type: "string", enum: ["EXPENSE", "INCOME", "TRANSFER"] },
          payment_method: {
            type: "string",
            enum: ["CASH", "DEBIT", "CREDIT", "TRANSFER", "UNKNOWN"],
          },
          is_installment: { type: "boolean" },
          installment_number: { type: "number" },
          total_installments: { type: "number" },
          expense_type: {
            type: "string",
            enum: ["FIXED", "VARIABLE", "EXTRAORDINARY", "UNKNOWN"],
          },
          suggested_category: { type: "string" },
          suggested_account_type: {
            type: "string",
            enum: ["CREDIT_CARD", "BANK", "DIGITAL_WALLET", "CASH", "SAVINGS", "UNKNOWN"],
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          is_charge: { type: "boolean" },
          is_tax: { type: "boolean" },
          warning: { type: "string" },
        },
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

function systemPrompt(): string {
  return [
    "Sos un asistente de importación de gastos para Financial OS, una app de finanzas personales argentina.",
    "Tu tarea: extraer TODAS las transacciones individuales del documento recibido.",
    "",
    "REGLAS ESTRICTAS:",
    "- Detectá cada consumo, cargo, impuesto o movimiento como transacción individual.",
    "- Nunca inventes montos, fechas o descripciones que no estén en el documento.",
    "- Si un dato no es legible: date='unknown', payment_method='UNKNOWN', expense_type='UNKNOWN', suggested_category='', suggested_account_type='UNKNOWN', warning='no se pudo leer'.",
    "- Para cuotas: detectá 'X/Y', 'cuota X de Y', '(X de Y)' — is_installment=true, installment_number=X, total_installments=Y.",
    "- Cargos bancarios/tarjeta: is_charge=true. Impuestos/percepciones: is_tax=true.",
    "- El campo 'amount' siempre positivo.",
    "- Usá ARS por defecto. USD solo si figura explícitamente.",
    "- NO incluyas el total/subtotal del resumen como transacción individual.",
    "- Para resúmenes de tarjeta: payment_method=CREDIT, suggested_account_type=CREDIT_CARD.",
    "- Respondé SOLO el JSON solicitado, sin texto adicional.",
  ].join("\n");
}

function userPrompt(): string {
  return [
    "Analizá este documento financiero y extraé todas las transacciones individuales.",
    "Para cada transacción detectá:",
    "- description: nombre del comercio o concepto (máx 80 caracteres)",
    "- amount: monto positivo",
    "- currency: ARS o USD",
    "- date: YYYY-MM-DD o 'unknown'",
    "- type: EXPENSE, INCOME o TRANSFER",
    "- payment_method: CASH, DEBIT, CREDIT, TRANSFER o UNKNOWN",
    "- is_installment / installment_number / total_installments: si hay cuotas",
    "- expense_type: FIXED, VARIABLE, EXTRAORDINARY o UNKNOWN",
    "- suggested_category: nombre sugerido en español (vacío si no sabés)",
    "- suggested_account_type: CREDIT_CARD, BANK, DIGITAL_WALLET, CASH, SAVINGS o UNKNOWN",
    "- confidence: certeza 0-1",
    "- is_charge / is_tax: si es cargo o impuesto",
    "- warning: advertencia si algo no es claro (vacío si todo está bien)",
  ].join("\n");
}

async function requestOpenAi(userContent: unknown[]): Promise<AiOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new ApiError(503, "El servicio de IA no está configurado.");

  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;

  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: userContent },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "smart_import",
          strict: true,
          schema: aiSchema,
        },
      },
    }),
  });

  if (!res.ok) {
    if (res.status === 401) throw new ApiError(503, "Error de autenticación con OpenAI.");
    if (res.status === 429) throw new ApiError(429, "El servicio de IA está saturado. Intentá en un momento.");
    throw new ApiError(502, "No se pudo procesar el documento. Intentá nuevamente.");
  }

  const payload = (await res.json()) as { output_text?: string; output?: unknown };
  const text = payload.output_text ?? extractOutputText(payload.output);

  if (!text) throw new ApiError(502, "La IA no devolvió un resultado válido.");

  try {
    return JSON.parse(text) as AiOutput;
  } catch {
    throw new ApiError(502, "La IA devolvió un formato inválido.");
  }
}

function extractOutputText(output: unknown): string | null {
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const c of item.content) {
      if (c && typeof c === "object" && "text" in c && typeof c.text === "string") return c.text;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

async function normalizeResult(
  raw: AiOutput,
  workspace: { householdId: string; accounts: WorkspaceAccount[]; categories: WorkspaceCategory[] },
): Promise<SmartImportResult> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = await prisma.transaction.findMany({
    where: { householdId: workspace.householdId, deletedAt: null, occurredAt: { gte: thirtyDaysAgo } },
    select: { id: true, amount: true, description: true, occurredAt: true },
  });

  const sourceType = raw.source_type ?? "UNKNOWN";
  const currency = raw.currency === "USD" ? CurrencyCode.USD : CurrencyCode.ARS;

  const candidates = (raw.transactions ?? []).map((tx, i) =>
    buildCandidate(tx, i, workspace, recent, sourceType),
  );

  return {
    candidates,
    metadata: {
      sourceType,
      currency,
      warnings: raw.warnings ?? [],
      totalDetected: candidates.length,
    },
  };
}

function buildCandidate(
  tx: AiTransaction,
  index: number,
  workspace: { accounts: WorkspaceAccount[]; categories: WorkspaceCategory[] },
  recent: Array<{ id: string; amount: unknown; description: string | null; occurredAt: Date }>,
  sourceType: string,
): SmartImportCandidate {
  const occurredAt = /^\d{4}-\d{2}-\d{2}$/.test(tx.date) ? tx.date : null;
  const type = toTransactionType(tx.type);
  const currency = tx.currency === "USD" ? CurrencyCode.USD : CurrencyCode.ARS;
  const paymentMethod = toPaymentMethod(tx.payment_method);
  const expenseType = toExpenseType(tx.expense_type);
  const isInstallment = tx.is_installment && tx.installment_number > 0 && tx.total_installments > 1;

  const { categoryId, categoryName } = mapCategory(tx.suggested_category, workspace.categories, type);
  const { accountId, accountName } = mapAccount(
    tx.suggested_account_type,
    paymentMethod,
    workspace.accounts,
    currency,
  );
  const { possibleDuplicate, duplicateInfo } = detectDuplicate(
    tx.amount,
    tx.description,
    occurredAt,
    recent,
  );

  return {
    id: `candidate_${Date.now()}_${index}`,
    description: (tx.description ?? "").trim().slice(0, 80),
    amount: Math.abs(tx.amount),
    currency,
    occurredAt,
    type,
    paymentMethod,
    expenseType,
    isInstallment,
    installmentNumber: isInstallment ? tx.installment_number : null,
    totalInstallments: isInstallment ? tx.total_installments : null,
    origin: toOrigin(sourceType),
    suggestedCategoryId: categoryId,
    suggestedCategoryName: categoryName,
    suggestedAccountId: accountId,
    suggestedAccountName: accountName,
    confidence: Math.min(1, Math.max(0, tx.confidence ?? 0)),
    isCharge: tx.is_charge,
    isTax: tx.is_tax,
    warning: tx.warning?.trim() || null,
    possibleDuplicate,
    duplicateInfo,
  };
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function toTransactionType(t: string): TransactionType {
  if (t === "INCOME") return TransactionType.INCOME;
  if (t === "TRANSFER") return TransactionType.TRANSFER;
  return TransactionType.EXPENSE;
}

function toPaymentMethod(m: string): PaymentMethod | null {
  switch (m) {
    case "CASH": return PaymentMethod.CASH;
    case "DEBIT": return PaymentMethod.DEBIT;
    case "CREDIT": return PaymentMethod.CREDIT;
    case "TRANSFER": return PaymentMethod.TRANSFER;
    default: return null;
  }
}

function toExpenseType(t: string): ExpenseType | null {
  switch (t) {
    case "FIXED": return ExpenseType.FIXED;
    case "VARIABLE": return ExpenseType.VARIABLE;
    case "EXTRAORDINARY": return ExpenseType.EXTRAORDINARY;
    default: return null;
  }
}

function toOrigin(sourceType: string): TransactionOrigin {
  switch (sourceType) {
    case "CARD_SUMMARY": return TransactionOrigin.CARD_SUMMARY;
    case "BANK": return TransactionOrigin.BANK;
    case "MERCADO_PAGO": return TransactionOrigin.MERCADO_PAGO;
    default: return TransactionOrigin.MANUAL;
  }
}

function normName(s: string | null | undefined): string {
  return (
    s
      ?.normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

function mapCategory(
  suggested: string,
  categories: WorkspaceCategory[],
  type: TransactionType,
): { categoryId: string | null; categoryName: string | null } {
  if (!suggested?.trim()) return { categoryId: null, categoryName: null };

  const norm = normName(suggested);
  const pool = categories.filter((c) => {
    if (type === TransactionType.INCOME) return c.type === "INCOME";
    if (type === TransactionType.EXPENSE) return c.type === "EXPENSE";
    return true;
  });

  const exact = pool.find((c) => normName(c.name) === norm);
  if (exact) return { categoryId: exact.id, categoryName: exact.name };

  const partial = pool.find(
    (c) => normName(c.name).includes(norm) || norm.includes(normName(c.name)),
  );
  if (partial) return { categoryId: partial.id, categoryName: partial.name };

  return { categoryId: null, categoryName: suggested.trim() };
}

const accountTypeMap: Record<string, AccountType> = {
  CREDIT_CARD: AccountType.CREDIT_CARD,
  BANK: AccountType.BANK,
  DIGITAL_WALLET: AccountType.DIGITAL_WALLET,
  CASH: AccountType.CASH,
  SAVINGS: AccountType.SAVINGS,
};

function mapAccount(
  suggestedType: string,
  paymentMethod: PaymentMethod | null,
  accounts: WorkspaceAccount[],
  currency: CurrencyCode,
): { accountId: string | null; accountName: string | null } {
  const pool = accounts.filter((a) => a.currency === currency || currency === CurrencyCode.ARS);

  const targetType =
    accountTypeMap[suggestedType] ??
    (paymentMethod === PaymentMethod.CREDIT
      ? AccountType.CREDIT_CARD
      : paymentMethod === PaymentMethod.DEBIT
        ? AccountType.BANK
        : paymentMethod === PaymentMethod.CASH
          ? AccountType.CASH
          : null);

  const byType = targetType ? pool.find((a) => a.type === targetType) : null;
  const byCurrency = pool.find((a) => a.currency === currency);
  const match = byType ?? byCurrency ?? accounts[0];

  return match ? { accountId: match.id, accountName: match.name } : { accountId: null, accountName: null };
}

function detectDuplicate(
  amount: number,
  description: string,
  dateStr: string | null,
  recent: Array<{ id: string; amount: unknown; description: string | null; occurredAt: Date }>,
): { possibleDuplicate: boolean; duplicateInfo: { date: string; amount: number; description: string } | null } {
  if (!dateStr) return { possibleDuplicate: false, duplicateInfo: null };

  const norm = normName(description);
  const target = Math.abs(amount);

  for (const tx of recent) {
    const txAmount = Number(tx.amount);
    const txDate = tx.occurredAt.toISOString().slice(0, 10);
    const txNorm = normName(tx.description);

    const sameDate = txDate === dateStr;
    const sameAmount = Math.abs(txAmount - target) < 0.01;
    const similarDesc = norm.length > 2 && txNorm.length > 2 && (txNorm.includes(norm) || norm.includes(txNorm));

    if (sameDate && sameAmount && similarDesc) {
      return {
        possibleDuplicate: true,
        duplicateInfo: { date: txDate, amount: txAmount, description: tx.description ?? "" },
      };
    }
  }

  return { possibleDuplicate: false, duplicateInfo: null };
}
