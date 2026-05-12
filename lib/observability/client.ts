"use client";

import * as Sentry from "@sentry/nextjs";

type TelemetryTag =
  | "auth"
  | "smart-import"
  | "ai"
  | "dashboard"
  | "onboarding"
  | "mobile"
  | "analytics";

type ProductEvent =
  | "route_viewed"
  | "onboarding_completed"
  | "smart_import_file_selected"
  | "smart_import_started"
  | "smart_import_cancelled"
  | "smart_import_slow"
  | "smart_import_succeeded"
  | "smart_import_failed"
  | "smart_import_confirm_started"
  | "smart_import_confirm_succeeded"
  | "smart_import_confirm_failed"
  | "ai_analysis_started"
  | "ai_analysis_succeeded"
  | "ai_analysis_failed"
  | "weekly_reflection_failed"
  | "offline_detected"
  | "online_restored"
  | "app_error";

const ALLOWED_PROPS = new Set([
  "area",
  "route",
  "status",
  "reason",
  "fileType",
  "fileSizeBucket",
  "candidateCount",
  "selectedCount",
  "createdCount",
  "errorCount",
  "cached",
  "stale",
  "mobile",
]);

export function setTelemetryUser(userId?: string | null) {
  Sentry.setUser(userId ? { id: userId } : null);
}

export function captureClientError(error: unknown, area: TelemetryTag, extra?: Record<string, unknown>) {
  Sentry.withScope((scope) => {
    scope.setTag("area", area);
    scope.setContext("safe_extra", filterEventProps(extra));
    Sentry.captureException(error);
  });
}

export function trackProductEvent(
  event: ProductEvent,
  properties: Record<string, unknown> = {},
  area: TelemetryTag = "analytics",
) {
  const safeProperties = filterEventProps({ ...properties, area });

  Sentry.addBreadcrumb({
    category: "product",
    message: event,
    level: "info",
    data: safeProperties,
  });

  if (typeof navigator !== "undefined") {
    const body = JSON.stringify({ event, properties: safeProperties });
    if (!navigator.sendBeacon?.("/api/analytics", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  }
}

function filterEventProps(properties: Record<string, unknown> | undefined) {
  if (!properties) return {};

  return Object.fromEntries(
    Object.entries(properties)
      .filter(([key]) => ALLOWED_PROPS.has(key))
      .map(([key, value]) => [key, normalizeValue(value)]),
  );
}

function normalizeValue(value: unknown) {
  if (typeof value === "string") return value.slice(0, 120);
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  return "[redacted]";
}
