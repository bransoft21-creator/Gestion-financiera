import * as Sentry from "@sentry/nextjs";
import { sanitizeForTelemetry } from "./lib/observability/sanitize";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  beforeSend(event) {
    event.user = event.user?.id ? { id: String(event.user.id) } : undefined;
    event.contexts = sanitizeForTelemetry(event.contexts) as typeof event.contexts;
    event.extra = sanitizeForTelemetry(event.extra) as typeof event.extra;
    event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({
      ...breadcrumb,
      data: sanitizeForTelemetry(breadcrumb.data) as typeof breadcrumb.data,
    }));
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
