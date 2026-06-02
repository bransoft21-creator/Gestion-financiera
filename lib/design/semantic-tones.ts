export type SemanticTone = "positive" | "warning" | "danger" | "info" | "brand" | "neutral";

export const semanticTones = {
  positive: {
    card:  "border-emerald-400/20 bg-emerald-400/[0.07]",
    shell: "border-emerald-500/20 bg-emerald-500/10",
    icon:  "bg-emerald-400/12 text-emerald-400",
    badge: "border-emerald-300/20 bg-emerald-300/10 text-emerald-400",
    text:  "text-emerald-400",
    dot:   "bg-emerald-400",
  },
  warning: {
    card:  "border-amber-300/20 bg-amber-300/[0.08]",
    shell: "border-amber-500/20 bg-amber-500/10",
    icon:  "bg-amber-300/12 text-amber-500",
    badge: "border-amber-300/20 bg-amber-300/10 text-amber-500",
    text:  "text-amber-500",
    dot:   "bg-amber-400",
  },
  danger: {
    card:  "border-rose-300/20 bg-rose-400/[0.08]",
    shell: "border-rose-500/20 bg-rose-500/10",
    icon:  "bg-rose-300/12 text-destructive",
    badge: "border-rose-300/20 bg-rose-300/10 text-destructive",
    text:  "text-destructive",
    dot:   "bg-rose-400",
  },
  info: {
    card:  "border-sky-300/20 bg-sky-400/[0.08]",
    shell: "border-sky-500/20 bg-sky-500/10",
    icon:  "bg-sky-300/12 text-sky-400",
    badge: "border-sky-300/20 bg-sky-300/10 text-sky-400",
    text:  "text-sky-400",
    dot:   "bg-sky-400",
  },
  brand: {
    card:  "border-teal-300/20 bg-teal-300/[0.08]",
    shell: "border-teal-500/20 bg-teal-500/10",
    icon:  "bg-teal-300/12 text-primary",
    badge: "border-teal-300/20 bg-teal-300/10 text-primary",
    text:  "text-primary",
    dot:   "bg-primary",
  },
  neutral: {
    card:  "border-border bg-muted/40",
    shell: "border-border bg-muted/40",
    icon:  "bg-muted text-foreground",
    badge: "border-border bg-muted text-muted-foreground",
    text:  "text-foreground",
    dot:   "bg-muted-foreground/60",
  },
} as const satisfies Record<SemanticTone, { card: string; shell: string; icon: string; badge: string; text: string; dot: string }>;
