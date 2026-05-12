type LogLevel = "info" | "warn" | "error";

const REDACTED_KEYS = new Set([
  "authorization",
  "cookie",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "apiKey",
  "api_key",
  "amount",
  "balance",
  "description",
  "notes",
]);

export function logEvent(level: LogLevel, event: string, metadata: Record<string, unknown> = {}) {
  const redacted = redact(metadata) as Record<string, unknown>;
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...redacted,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

function redact(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      REDACTED_KEYS.has(key) ? "[redacted]" : redact(item),
    ]),
  );
}
