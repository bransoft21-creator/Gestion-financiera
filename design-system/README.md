# Design System V2

Design System V2 is the visual and UX foundation for evolving this product from a finance CRUD dashboard into a premium Financial Operating System.

## Product Position

The app should feel like a financial copilot, not an accounting back office. Screens should answer one user question at a time:

- What should I know today?
- What changed?
- What deserves attention?
- What action improves the month?

## Principles

1. Narrative before density. Start with meaning, then let users drill down.
2. Mobile first, desktop capable. Every pattern must work beautifully on iPhone before being expanded on desktop.
3. Fewer surfaces, better surfaces. Prefer one high-quality card with hierarchy over four equal dashboard widgets.
4. Calm intelligence. The UI should feel aware and contextual, without screaming alerts.
5. Progressive disclosure. CRUD details live behind summaries, drawers, filters, and focused states.
6. Semantic color. Color means behavior or financial signal, not decoration.
7. Motion with intent. Use animation to orient, reveal, and confirm; avoid motion as ornament.

## Architecture

Target folders:

- `/design-system`: product principles, token source, migration notes.
- `/styles/tokens`: CSS custom properties and global utilities.
- `/components/ui-v2`: primitive visual components.
- `/components/finance`: finance-specific cards and summaries.
- `/components/copilot`: AI and narrative assistant patterns.
- `/components/insights`: feed cards, alerts, recommendations, opportunities.
- `/components/layout`: route/page layout primitives.

## Migration Rule

Do not rewrite a whole feature just to restyle it. Replace local ad-hoc surfaces with V2 primitives as a screen is touched:

1. Page shell and header.
2. Primary summary card.
3. Empty/loading/error states.
4. Lists and forms.
5. Secondary widgets.

## Current Foundation

- CSS tokens: `/styles/tokens/design-system-v2.css`
- TS tokens: `/design-system/tokens.ts`
- Primitive surfaces: `/components/ui-v2`
- Finance/insight/layout examples: `/components/finance`, `/components/insights`, `/components/layout`
