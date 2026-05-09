# Design System V2 Audit & Roadmap

## Executive Summary

The product has outgrown its original "expense tracker / finance CRUD" skin. The new AI analysis module already points toward the right product direction: a premium, narrative Financial Copilot. The rest of the app still reads as an admin dashboard because most screens expose data structures first and user meaning second.

The correct migration is progressive: establish V2 tokens and primitives, then migrate dashboard, navigation, home/login, AI/Copilot, transactions, and finance cards in that order. Backend logic, Prisma services, Supabase auth, and existing API contracts should remain untouched.

## Priority Problems

### P0 - Brand And Product Identity

- The app still says "Finance Control" and "Gestión de gastos", which anchors the product in CRUD/tracker territory.
- Dashboard copy uses administrative language: "Vista ejecutiva", "transacciones reales", "registro central".
- Navigation labels are functional buckets, not product mental models.
- The AI/Copilot section looks like the future product; surrounding screens look like the old app.

Recommended direction: rename product surface language toward "Financial Copilot" or "Operating System financiero". Keep legal/internal naming separate if needed.

### P0 - Visual Inconsistency

- V1 components use `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-[28px]`, and custom pixel radii with no hierarchy.
- Cards mix `bg-card`, `bg-background/35`, `bg-white/[0.03]`, hard-coded gradients, and inline styles.
- Accent color is mostly violet/indigo, while the new Copilot card introduced a more premium teal/warm/zinc system.
- Shadows vary from small shadcn shadows to large Copilot glows without a shared elevation scale.

Fix: route all new work through V2 tokens and primitives in `/styles/tokens` and `/components/ui-v2`.

### P0 - Dashboard Still Feels Like A Dashboard

- The page starts with a technical page header and month selector, then a large financial formula card.
- Stat cards duplicate the hero rather than guiding the user.
- Category charts, composition, projection, signals, and transactions are all visible at once.
- The order answers "what data exists?" more than "what should I know today?"

Fix: Dashboard V2 should be a daily financial briefing:

1. Hero: "Brandon, this is what matters today."
2. Copilot collapsed summary.
3. Three important signals.
4. One primary action.
5. Drill-down modules.

### P1 - Navigation

- Desktop sidebar feels like a SaaS admin rail.
- Mobile bottom nav is usable, but "Más" drawer exposes feature taxonomy rather than a guided IA/product hierarchy.
- User actions are split across header controls, sidebar footer, notification panel, and bottom nav.

Fix: create a calm iOS-like navigation system:

- Home
- Money
- Movements
- Plan
- Copilot

Move "categories/accounts/reports" to contextual settings or secondary surfaces over time.

### P1 - Forms And CRUD Screens

- Transactions, budgets, goals, debts, recurring, accounts, categories are still form/list management views.
- Several flows use `window.confirm`, which feels browser-native and breaks premium perception.
- Tables are mostly avoided, but lists still feel dense and administrative.
- Forms use many equal-weight fields; key decisions are not guided.

Fix: migrate forms to mobile drawers/sheets with grouped intent:

- What happened?
- Where did it happen?
- How should Copilot classify it?
- Optional details.

### P1 - Mobile Rhythm

- Existing bottom nav is functional, but cards and page headers still use desktop mental models.
- Some grid sections collapse correctly but remain visually dense.
- Financial numbers can truncate; some labels rely on tiny uppercase metadata.

Fix: V2 mobile screens need one-column feed rhythm, 44px+ controls, no nested cards, and larger narrative summaries.

### P2 - Motion And Feedback

- Current app uses CSS animation utilities and the Copilot section uses Framer Motion.
- Motion is not centrally defined.
- Loading states mix skeletons, spinners, cards, and empty blocks.

Fix: V2 motion tokens:

- Enter: fade + 14px y + soft blur.
- Cards: 0.18s hover lift.
- Drawers: spring, high damping.
- Loading: premium shimmer/skeleton for surfaces, spinners only inside explicit buttons.

## Quick Wins

1. Replace app name in visible product chrome: "Finance Control" -> "Financial OS" or "Copilot Financiero".
2. Upgrade `PageHeader` copy and typography to V2; stop using "Dashboard".
3. Replace existing `Card` usage in dashboard with `PremiumCard` as screens are touched.
4. Move month selector into a compact floating control below the hero.
5. Convert desktop sidebar logo and mobile nav to V2 tone: glass, softer selected state, less violet.
6. Replace `window.confirm` with a premium confirmation modal/sheet.
7. Standardize empty states with one premium component.
8. Use V2 action buttons for primary route actions.

## Visual Identity Proposal

### Product Feel

Financial Operating System: calm, aware, high-trust, low-noise.

### Palette

- Base: near-black zinc/navy for premium depth.
- Primary intelligence: teal for active insight and Copilot presence.
- Warm signal: amber for opportunity, projection, and "pay attention".
- Deep accent: violet only as a secondary intelligence accent, not the whole brand.
- Finance states: emerald positive, rose risk, sky informative.

### Typography

- Use system sans until a dedicated font is introduced.
- Hero: 36-56px, semibold, tight line-height.
- Page title: 30-36px, semibold.
- Card title: 16-20px, semibold.
- Body: 14px, 1.5-1.7 line-height.
- Metrics: tabular numbers, semibold, never all metrics at the same scale.
- Avoid excessive uppercase; reserve for tiny metadata only.

### Spacing

- Page x-padding: 16px mobile, 24-32px desktop.
- Feed gap: 20-28px.
- Card padding: 16-24px.
- Touch targets: 44px minimum.
- Avoid nested cards; use bands, rows, or quiet dividers inside cards.

### Shape

- Small controls: 12px radius.
- Buttons/inputs: 16px radius.
- Cards: 22px radius.
- Hero surfaces: 24-28px radius.
- Avoid mixed one-off pixel radii unless format-specific.

### Elevation

- Level 0: no shadow, quiet surface.
- Level 1: glass card, subtle border.
- Level 2: raised card, 70-80px soft black shadow.
- Level 3: modal/sheet, stronger border and blur.
- Glow is reserved for Copilot/insight moments.

## UX Architecture V2

### Dashboard

Target: "What should I know today?"

- Financial briefing hero.
- Collapsible Copilot summary.
- Insight feed with 3 prioritized cards.
- Today/this month action.
- Compact drill-down cards for spending, upcoming obligations, hidden expenses.

### Navigation

Target: "Where am I in my financial OS?"

- Mobile bottom nav with fewer, more meaningful destinations.
- Desktop rail should feel like a native app sidebar, not admin nav.
- Secondary management pages can live under settings or contextual menus later.

### Transactions

Target: "Understand and correct money movement."

- Search + filter should become a command surface.
- Transaction list should be grouped by day and narrative labels.
- Creation flow should be a guided sheet, not a raw form.

### Budgets / Goals / Debts

Target: "Plan, commit, reduce pressure."

- Budget screen becomes "Plan del mes".
- Goals become progress stories with next contribution.
- Debts become pressure/relief view, not loan table.

### Reports

Target: "Patterns and learning."

- Replace chart-first reporting with story-first insights.
- Charts remain as drill-down evidence.

### Onboarding/Login

Target: "This is a premium financial copilot."

- Current login still sells "control total" and "gestión profesional".
- New onboarding should preview the Copilot experience and emotional outcome.

## Design System V2 Folder Contract

Created foundation:

- `/design-system/README.md`
- `/design-system/tokens.ts`
- `/styles/tokens/design-system-v2.css`
- `/components/ui-v2/premium-card.tsx`
- `/components/ui-v2/action-button.tsx`
- `/components/ui-v2/section-header.tsx`
- `/components/finance/finance-metric-card.tsx`
- `/components/copilot/copilot-summary-orb.tsx`
- `/components/insights/insight-feed-card.tsx`
- `/components/layout/v2-page-shell.tsx`

## Component Strategy

### Primitive Layer

- `PremiumCard`: all new cards and premium panels.
- `ActionButton`: primary/glass/quiet/danger actions.
- `SectionHeader`: narrative section titles with optional eyebrow/action.

### Finance Layer

- `FinanceMetricCard`: compact financial metric with semantic tone and trend.
- Future: `MoneyFlowRow`, `ObligationCard`, `GoalProgressCard`, `DebtPressureCard`.

### Copilot Layer

- `CopilotSummaryOrb`: score/health visualization.
- Future: `CopilotBriefing`, `CopilotPromptBar`, `CopilotInsightStack`.

### Insight Layer

- `InsightFeedCard`: recommendations, alerts, opportunities, pattern cards.
- Future: `InvisibleExpenseList`, `PredictionCard`, `ChangeStoryCard`.

### Layout Layer

- `V2PageShell`: page wrapper with premium title hierarchy.
- Future: `MobileCommandHeader`, `V2BottomNav`, `V2Sidebar`.

## Migration Roadmap

### Phase 1 - Foundation

Status: started.

- Add tokens and V2 primitives.
- Document audit and product direction.
- Keep existing backend and routes.

### Phase 2 - Dashboard V2

- Replace `PageHeader` copy for dashboard.
- Use `V2PageShell`.
- Rebuild dashboard order around a financial briefing.
- Convert stat cards to `FinanceMetricCard`.
- Reduce simultaneous modules above the fold.

### Phase 3 - Navigation V2

- New product naming.
- Glass desktop sidebar.
- Mobile bottom nav with semantic destinations.
- Move secondary admin items behind More/Settings.

### Phase 4 - Transactions V2

- Grouped mobile-first transaction feed.
- Filter command surface.
- Guided create/edit sheet.
- Premium delete confirmation.

### Phase 5 - Planning Screens

- Budgets -> Plan del mes.
- Goals -> Future money.
- Debts -> Pressure and payoff.
- Recurring -> Commitments.

### Phase 6 - Reports / Intelligence

- Report pages become insight narratives.
- Charts become supporting evidence, not the lead.

## Motion Guidelines

- Use Framer Motion for interactive V2 surfaces.
- Page sections enter with fade + y + blur.
- Cards may lift 2-4px on hover.
- Buttons active-scale to 0.98.
- Avoid long transitions over 500ms except full-screen route/sheet transitions.
- Respect reduced motion through CSS and Framer's reduced-motion hooks in future interactive components.

## Acceptance Criteria For V2 Screens

- The first viewport answers one user question.
- No table is visible above the fold on mobile.
- No more than three equally weighted metrics at once.
- Every primary action has one clear label.
- Empty/loading/error states look designed, not fallback.
- Works at 375px width without overflow.
- Looks coherent next to the Copilot section.
