# Launch Safety Checklist

## Security
- CSP enabled with explicit `script-src`, `connect-src`, `img-src`, `frame-src`, `worker-src`, and `object-src 'none'`.
- Same-origin CSRF guard enabled for API mutations.
- API rate limiting supports Upstash Redis via `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- Supabase service-role keys must stay server-only and never use a `NEXT_PUBLIC_` prefix.
- Vercel Firewall/WAF should enforce bot protection and upload/AI endpoint rules before public beta.

## AI Cost And Abuse
- `AiUsage` records endpoint, model, tokens, estimated cost, and timestamp.
- Daily/monthly quotas are enforced before paid AI calls.
- Smart Import file hashes are cached per household to avoid reprocessing the same file.
- PDF text is treated as untrusted data and prompt instructions inside documents are ignored.
- Weekly/monthly analyses reuse input hashes and avoid regeneration when data did not change.

## Financial Integrity
- Transaction create/update/delete runs in database transactions.
- Account balance deltas and linked debt/goal effects are reversed before edits/deletes.
- Smart Import candidate import checks exact duplicate imported transactions.
- Tests cover over-budget, overpaid debt, canceled transaction, transfer, debt, goal, and dashboard formula cases.

## Observability
- API fallback errors are logged as structured events without raw request bodies or sensitive fields.
- Add Sentry or equivalent before beta with source maps and request tracing.
- Product analytics should track onboarding, activation, Smart Import, AI usage, and dashboard engagement without financial amounts.

## Mobile And Accessibility
- Viewport zoom is enabled; `userScalable: false` is not used.
- Validate Safari iPhone, Chrome Android, 360px width, keyboard overlap, safe areas, dialogs, scrolling, touch targets, and orientation.

## Performance And Resilience
- Keep charts, AI, and Smart Import lazy where possible.
- Monitor Web Vitals, slow queries, hydration cost, and bundle size.
- AI failures should degrade gracefully and never block core financial data entry.
- Import flows must show partial failures and keep created transactions explicit.
