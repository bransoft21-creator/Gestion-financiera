"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
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
    card: "border-white/10 bg-white/[0.045]",
    icon: "bg-white/10 text-zinc-100",
    label: "border-white/10 bg-white/10 text-zinc-200",
  },
  positive: {
    card: "border-emerald-300/20 bg-emerald-300/[0.07]",
    icon: "bg-emerald-300/12 text-emerald-100",
    label: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
  },
  warning: {
    card: "border-amber-300/20 bg-amber-300/[0.08]",
    icon: "bg-amber-300/12 text-amber-100",
    label: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  },
  danger: {
    card: "border-rose-300/20 bg-rose-300/[0.08]",
    icon: "bg-rose-300/12 text-rose-100",
    label: "border-rose-300/20 bg-rose-300/10 text-rose-100",
  },
  info: {
    card: "border-sky-300/20 bg-sky-300/[0.08]",
    icon: "bg-sky-300/12 text-sky-100",
    label: "border-sky-300/20 bg-sky-300/10 text-sky-100",
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
        <h3 className="text-balance text-lg font-semibold leading-tight text-white">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{message}</p>
        {detail && <p className="mt-4 text-xs leading-5 text-zinc-500">{detail}</p>}
        {action && <div className="mt-5">{action}</div>}
      </PremiumCard>
    </motion.article>
  );
}
