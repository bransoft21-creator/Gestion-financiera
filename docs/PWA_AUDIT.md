# PWA Audit

## Current Decision
- PWA is disabled by default for beta unless `ENABLE_PWA=1`.
- `public/sw.js` unregisters any previously installed service worker and clears old caches.
- If PWA is explicitly re-enabled, aggressive route caching is off and runtime caching is empty.

## Why
- The generated Workbox service worker cached App Router pages, RSC payloads, `_next/data`, and same-origin API `GET` responses with one-day retention.
- For a financial app, offline/stale dashboard or report data is riskier than losing offline shell behavior during beta.
- `@ducanh2912/next-pwa@10.2.9` is the latest published version but still depends on Workbox packages flagged by `npm audit`.

## Safe Beta Recommendation
- Keep PWA disabled for private beta.
- Use the global offline banner as the beta offline UX.
- Revisit PWA only after replacing the plugin or designing explicit no-store rules for financial routes.

## Re-enable Requirements
- No caching for `/api/*`.
- No caching for authenticated pages, RSC payloads, dashboard, reports, transactions, accounts, budgets, debts, goals, Smart Import, or profile.
- Cache only immutable static assets with hashed filenames.
- Add a release/update UX so users cannot keep stale financial UI after deploy.
