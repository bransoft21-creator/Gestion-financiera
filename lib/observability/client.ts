"use client";

import * as Sentry from "@sentry/nextjs";

type TelemetryTag =
  | "auth"
  | "smart-import"
  | "ai"
  | "dashboard"
  | "onboarding"
  | "household"
  | "mobile"
  | "education"
  | "analytics";

type ProductEvent =
  // Navigation
  | "route_viewed"
  // Onboarding
  | "onboarding_started"
  | "onboarding_goals_advanced"
  | "onboarding_completed"
  // Smart Import
  | "smart_import_file_selected"
  | "smart_import_file_uploaded"
  | "smart_import_started"
  | "smart_import_retry"
  | "smart_import_slow"
  | "smart_import_succeeded"
  | "smart_import_mapping_completed"
  | "smart_import_preview_opened"
  | "smart_import_ai_invoked"
  | "smart_import_ai_mapping_suggested"
  | "smart_import_ai_mapping_accepted"
  | "smart_import_ai_mapping_rejected"
  | "smart_import_ai_fallback_used"
  | "smart_import_review_started"
  | "smart_import_failed"
  | "smart_import_cancelled"
  | "smart_import_confirmed"
  | "smart_import_confirm_started"
  | "smart_import_confirm_succeeded"
  | "smart_import_confirm_failed"
  | "smart_import_completed"
  // Household
  | "household_created"
  | "household_invite_created"
  | "settlement_created"
  | "recurring_payment_created"
  | "recurring_payment_paid"
  // Dashboard engagement
  | "dashboard_section_expanded"
  | "getting_started_card_dismissed"
  | "getting_started_action_clicked"
  | "reflection_opened"
  | "monthly_analysis_opened"
  | "hide_amounts_toggled"
  // Weekly Pulse
  | "weekly_pulse_viewed"
  | "weekly_pulse_dismissed"
  | "pulse_notification_opened"
  // Monthly Close
  | "monthly_close_viewed"
  | "monthly_close_dismissed"
  | "monthly_close_notification_opened"
  // Contextual education
  | "education_viewed"
  | "education_dismissed"
  | "education_expanded"
  | "education_saved"
  | "education_action_clicked"
  // Notifications
  | "notification_received"
  | "notification_opened"
  | "notification_dismissed"
  // AI
  | "ai_analysis_started"
  | "ai_analysis_succeeded"
  | "ai_analysis_failed"
  | "weekly_reflection_failed"
  // Core financial actions
  | "account_created"
  | "transaction_created"
  | "budget_created"
  | "goal_created"
  | "debt_created"
  | "export_used"
  // FX
  | "fx_rate_updated"
  // Tutorial
  | "tutorial_started"
  | "tutorial_completed"
  | "tutorial_skipped"
  // System
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
  "goalCount",
  "startOption",
  "section",
  "actionCount",
  "actionId",
  "actionIndex",
  "isOnboardingFresh",
  "memberCount",
  "replayMode",
  "cached",
  "stale",
  "mobile",
  // FX
  "fxRateBucket",
  // Tutorial
  "step",
  "totalSteps",
  // Exports
  "format",
  // Financial entity types
  "entityType",
  // Weekly Pulse
  "tone",
  "signalCount",
  "insightCount",
  // Notifications
  "count",
  "type",
  "priority",
  // Contextual education
  "educationId",
  "surface",
  "category",
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
