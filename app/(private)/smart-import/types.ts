export type TxType = "INCOME" | "EXPENSE" | "TRANSFER";
export type Currency = "ARS" | "USD";
export type PayMethod = "CASH" | "DEBIT" | "CREDIT" | "TRANSFER" | null;
export type ExpType = "FIXED" | "VARIABLE" | "EXTRAORDINARY" | null;
export type Origin = "MANUAL" | "CARD_SUMMARY" | "BANK" | "MERCADO_PAGO";

export type ImportCandidate = {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  occurredAt: string | null;
  type: TxType;
  paymentMethod: PayMethod;
  expenseType: ExpType;
  isInstallment: boolean;
  installmentNumber: number | null;
  totalInstallments: number | null;
  origin: Origin;
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

export type ImportMetadata = {
  sourceType: string;
  currency: Currency;
  currencyTotals?: Array<{ currency: Currency; count: number; amount: number }>;
  mixedCurrencies?: boolean;
  warnings: string[];
  totalDetected: number;
  mappingConfidence?: number;
  aiAssisted?: boolean;
  aiFallbackUsed?: boolean;
  aiReasoning?: string | null;
  statementSummary?: {
    statementTotal: number | null;
    totalConsumptions: number | null;
    minimumPayment: number | null;
    dueDate: string | null;
    closeDate: string | null;
    periodYear: number | null;
    periodMonth: number | null;
    confidence: number;
  } | null;
};

export type WorkspaceAccount = { id: string; name: string; type: string; currency: Currency };
export type WorkspaceCategory = { id: string; name: string; type: string };

export type CandidateState = ImportCandidate & {
  selected: boolean;
  expanded: boolean;
  editDescription: string;
  editAmount: string;
  editDate: string;
  editAccountId: string;
  editCategoryId: string;
  editType: TxType;
};

export type Step = "upload" | "processing" | "review" | "confirming" | "done";
export type CandidateFilter = "all" | "safe" | "review" | "duplicates";
