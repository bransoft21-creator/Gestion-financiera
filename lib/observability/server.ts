import * as Sentry from "@sentry/nextjs";
import { logEvent } from "@/server/api/logging";
import { sanitizeForTelemetry } from "./sanitize";

type Area = "auth" | "smart-import" | "ai" | "dashboard" | "onboarding" | "mobile" | "api";

export function captureServerError(
  error: unknown,
  area: Area,
  metadata: Record<string, unknown> = {},
) {
  const safeMetadata = sanitizeForTelemetry(metadata) as Record<string, unknown>;

  logEvent("error", `${area}.error`, {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unknown error",
    ...safeMetadata,
  });

  Sentry.withScope((scope) => {
    scope.setTag("area", area);
    scope.setContext("safe_metadata", safeMetadata);
    Sentry.captureException(error);
  });
}

export function captureServerMessage(
  message: string,
  area: Area,
  metadata: Record<string, unknown> = {},
) {
  const safeMetadata = sanitizeForTelemetry(metadata) as Record<string, unknown>;

  logEvent("warn", `${area}.warning`, safeMetadata);

  Sentry.withScope((scope) => {
    scope.setTag("area", area);
    scope.setContext("safe_metadata", safeMetadata);
    Sentry.captureMessage(message, "warning");
  });
}
