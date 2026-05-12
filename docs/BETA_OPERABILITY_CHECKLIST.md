# Beta Operability Checklist

## Observability
- Configure `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` for source maps.
- Keep Sentry user context to hashed internal IDs only.
- Review Sentry daily for `area=smart-import`, `area=ai`, `area=dashboard`, `area=auth`, and `area=mobile`.
- Product events must never include amounts, descriptions, prompts, screenshots, PDFs, or raw emails.

## Recovery UX
- Global and private route errors show calm retry actions.
- Offline state is visible globally.
- Smart Import supports cancel, retry, slow-processing copy, partial import messaging, and duplicate warnings.
- AI cards show retryable failures instead of breaking the dashboard.

## Beta Operations
- `DISABLE_AI=1` turns off AI endpoints.
- `DISABLE_SMART_IMPORT=1` turns off Smart Import without disabling the rest of AI.
- `BETA_ALLOWLIST_EMAILS` restricts beta access when populated.
- `MAINTENANCE_MODE=1` returns a calm 503 with `Retry-After`.
- Upstash Redis must be configured before inviting real users.

## Daily Watchlist
- Smart Import failures, timeouts, partial saves, and duplicate rates.
- AI quota rejections and OpenAI provider errors.
- Route error count by area.
- Onboarding completion and first transaction activation.
- Mobile offline events and viewport-specific bug reports.

## Support Expectations
- Some PDFs/screenshots will be unreadable or partially interpreted.
- Users may need to retry AI when provider latency spikes.
- Mobile upload behavior can differ by Safari/Android browser.
- Imports may save partially when individual candidate rows fail validation.
