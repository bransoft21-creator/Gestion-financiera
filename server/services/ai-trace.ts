import { createHash } from "node:crypto";

type TraceMetadata = Record<string, string | number | boolean | null | undefined>;

export function traceAi(step: string, metadata: TraceMetadata = {}) {
  if (process.env.AI_TRACE !== "1") return;

  console.log(step, sanitizeTraceMetadata(metadata));
}

export function traceUserId(userId: string) {
  return createHash("sha256").update(userId).digest("hex").slice(0, 10);
}

function sanitizeTraceMetadata(metadata: TraceMetadata) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  );
}
