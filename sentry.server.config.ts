import * as Sentry from "@sentry/nextjs";
import { sanitizeForTelemetry } from "./lib/observability/sanitize";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.APP_ENV ?? process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  beforeSend(event) {
    event.user = event.user?.id ? { id: String(event.user.id) } : undefined;
    event.request = event.request
      ? {
          method: event.request.method,
          url: event.request.url,
          headers: sanitizeForTelemetry(event.request.headers) as Record<string, string>,
        }
      : undefined;
    event.contexts = sanitizeForTelemetry(event.contexts) as typeof event.contexts;
    event.extra = sanitizeForTelemetry(event.extra) as typeof event.extra;
    return event;
  },
});
