export const EXPORT_SCHEMA_VERSION = "2026-05-16.1";

type ExportMetadataInput = {
  exportedAt: string;
  timezone: string | null | undefined;
  locale: string | null | undefined;
  appVersion: string;
  format: "json" | "transactions-csv";
  householdId?: string | null;
  recordCounts: Record<string, number>;
};

export type TransactionCsvRow = {
  occurredAt: Date | string;
  type: string;
  status: string;
  currency: string;
  amount: number;
  description: string | null;
  accountName: string;
  categoryName: string | null;
  expenseType: string | null;
  isRecurring: boolean;
  isInstallment: boolean;
};

export function buildExportMetadata(input: ExportMetadataInput) {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: input.exportedAt,
    timezone: input.timezone ?? "America/Argentina/Buenos_Aires",
    locale: input.locale ?? "es-AR",
    appVersion: input.appVersion,
    format: input.format,
    householdId: input.householdId ?? null,
    recordCounts: input.recordCounts,
  };
}

export function formatTransactionsCsv(rows: TransactionCsvRow[]): string {
  const headers = [
    "occurredAt",
    "type",
    "status",
    "currency",
    "amount",
    "description",
    "accountName",
    "categoryName",
    "expenseType",
    "isRecurring",
    "isInstallment",
  ] satisfies Array<keyof TransactionCsvRow>;

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((key) => escapeCsvValue(normalizeCsvValue(row[key]))).join(",")),
  ];

  return lines.join("\n") + "\n";
}

function normalizeCsvValue(value: TransactionCsvRow[keyof TransactionCsvRow]): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function escapeCsvValue(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll("\"", "\"\"")}"`;
}
