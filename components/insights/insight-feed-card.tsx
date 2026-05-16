"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { SensitiveText } from "@/components/app/sensitive-amount";
import { PremiumCard } from "@/components/ui-v2/premium-card";
import { cn } from "@/lib/utils";

type InsightTone = "neutral" | "positive" | "warning" | "danger" | "info";

type InsightFeedCardProps = {
  title: string;
  message: string;
  detail?: string;
  icon: LucideIcon;
  tone?: InsightTone;
  priority?: "Alta" | "Media" | "Suave";
  action?: React.ReactNode;
  className?: string;
};

const toneConfig = {
  neutral: {
    card: "border-border bg-muted/40",
    icon: "bg-muted text-foreground",
    label: "border-border bg-muted text-muted-foreground",
  },
  positive: {
    card: "border-emerald-300/20 bg-emerald-300/[0.07]",
    icon: "bg-emerald-300/12 text-emerald-400",
    label: "border-emerald-300/20 bg-emerald-300/10 text-emerald-400",
  },
  warning: {
    card: "border-amber-300/20 bg-amber-300/[0.08]",
    icon: "bg-amber-300/12 text-amber-500",
    label: "border-amber-300/20 bg-amber-300/10 text-amber-500",
  },
  danger: {
    card: "border-rose-300/20 bg-rose-300/[0.08]",
    icon: "bg-rose-300/12 text-destructive",
    label: "border-rose-300/20 bg-rose-300/10 text-destructive",
  },
  info: {
    card: "border-sky-300/20 bg-sky-300/[0.08]",
    icon: "bg-sky-300/12 text-sky-400",
    label: "border-sky-300/20 bg-sky-300/10 text-sky-400",
  },
} as const;

export function InsightFeedCard({
  title,
  message,
  detail,
  icon: Icon,
  tone = "neutral",
  priority = "Media",
  action,
  className,
}: InsightFeedCardProps) {
  const styles = toneConfig[tone];

  return (
    <motion.article whileHover={{ y: -3 }} transition={{ duration: 0.18 }} className={className}>
      <PremiumCard className={cn("p-4 sm:p-5", styles.card)}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", styles.icon)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", styles.label)}>{priority}</span>
        </div>
        <h3 className="text-balance text-lg font-semibold leading-tight text-foreground">
          <SensitiveText text={title} />
        </h3>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          <SensitiveText text={message} />
        </p>
        {detail && (
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            <SensitiveText text={detail} />
          </p>
        )}
        {action && <div className="mt-5">{action}</div>}
      </PremiumCard>
    </motion.article>
  );
}
