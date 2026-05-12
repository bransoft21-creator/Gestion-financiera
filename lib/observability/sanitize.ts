const SENSITIVE_KEYS = new Set([
  "amount",
  "balance",
  "currentBalance",
  "openingBalance",
  "creditLimit",
  "description",
  "notes",
  "prompt",
  "input",
  "pdf",
  "screenshot",
  "file",
  "authorization",
  "cookie",
  "token",
  "password",
  "email",
]);

export function sanitizeForTelemetry(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitizeForTelemetry);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.has(key) ? "[redacted]" : sanitizeForTelemetry(item),
    ]),
  );
}
