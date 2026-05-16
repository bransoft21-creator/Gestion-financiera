import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { PremiumCard } from "@/components/ui-v2/premium-card";
import { cn } from "@/lib/utils";

type FinanceMetricTone = "neutral" | "positive" | "warning" | "danger" | "info";

type FinanceMetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  tone?: FinanceMetricTone;
  trend?: "up" | "down" | "flat";
  trendLabel?: string;
  className?: string;
};

const toneConfig = {
  neutral: "bg-muted/70 text-foreground",
  positive: "bg-emerald-300/12 text-emerald-400",
  warning: "bg-amber-300/12 text-amber-500",
  danger: "bg-rose-300/12 text-destructive",
  info: "bg-sky-300/12 text-sky-400",
} as const;

const toneShellConfig = {
  neutral: "bg-muted/25",
  positive: "border-emerald-300/16 bg-emerald-300/[0.045]",
  warning: "border-amber-300/16 bg-amber-300/[0.045]",
  danger: "border-rose-300/16 bg-rose-300/[0.045]",
  info: "border-sky-300/16 bg-sky-300/[0.045]",
} as const;

export function FinanceMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
  trend = "flat",
  trendLabel,
  className,
}: FinanceMetricCardProps) {
  const TrendIcon = trend === "down" ? ArrowDownRight : ArrowUpRight;

  return (
    <PremiumCard interactive className={cn("p-4 sm:p-5", toneShellConfig[tone], className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          {detail && <p className="mt-1.5 truncate text-xs text-muted-foreground">{detail}</p>}
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", toneConfig[tone])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      {trendLabel && (
        <div className="mt-4 inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
          {trend !== "flat" && <TrendIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          <span className="truncate">{trendLabel}</span>
        </div>
      )}
    </PremiumCard>
  );
}
