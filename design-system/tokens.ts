export const v2ColorTokens = {
  background: "hsl(var(--v2-bg))",
  backgroundSoft: "hsl(var(--v2-bg-soft))",
  surface: "hsl(var(--v2-surface))",
  surfaceRaised: "hsl(var(--v2-surface-raised))",
  border: "hsl(var(--v2-border))",
  text: "hsl(var(--v2-text))",
  muted: "hsl(var(--v2-text-muted))",
  subtle: "hsl(var(--v2-text-subtle))",
  brand: "hsl(var(--v2-brand))",
  brandWarm: "hsl(var(--v2-brand-2))",
  brandDeep: "hsl(var(--v2-brand-3))",
  positive: "hsl(var(--v2-positive))",
  warning: "hsl(var(--v2-warning))",
  danger: "hsl(var(--v2-danger))",
  info: "hsl(var(--v2-info))",
} as const;

export const v2RadiusTokens = {
  sm: "var(--v2-radius-sm)",
  md: "var(--v2-radius-md)",
  lg: "var(--v2-radius-lg)",
  xl: "var(--v2-radius-xl)",
  full: "999px",
} as const;

export const v2SpacingTokens = {
  pageX: "clamp(1rem, 3vw, 2rem)",
  sectionGap: "clamp(1.25rem, 3vw, 2rem)",
  cardPadding: "clamp(1rem, 2.4vw, 1.5rem)",
  touchTarget: "2.75rem",
} as const;

export const v2MotionTokens = {
  easeOut: [0.22, 1, 0.36, 1],
  fast: 0.18,
  base: 0.32,
  slow: 0.5,
  spring: {
    type: "spring",
    stiffness: 420,
    damping: 34,
    mass: 0.75,
  },
  fadeUp: {
    hidden: { opacity: 0, y: 14, filter: "blur(8px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)" },
  },
} as const;

export const v2TypographyTokens = {
  hero: "text-4xl font-semibold leading-[1.02] sm:text-6xl",
  pageTitle: "text-3xl font-semibold leading-tight sm:text-4xl",
  sectionTitle: "text-xl font-semibold leading-tight",
  cardTitle: "text-base font-semibold leading-tight",
  body: "text-sm leading-6",
  caption: "text-xs leading-5",
  metric: "font-semibold tabular-nums",
} as const;
