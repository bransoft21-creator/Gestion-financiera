"use client";

import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useCountUp } from "@/hooks/use-count-up";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "default" | "positive" | "warning" | "danger";
  highlight?: boolean;
  rawValue?: number;
  formatter?: (n: number) => string;
  animationDelay?: number;
};

const toneIconClasses = {
  default: "bg-sky-500/15 text-sky-400",
  positive: "bg-emerald-500/15 text-emerald-400",
  warning: "bg-amber-500/15 text-amber-400",
  danger: "bg-rose-500/15 text-rose-400",
};

const toneValueClasses = {
  default: "text-sky-400",
  positive: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-rose-400",
};

function AnimatedValue({
  raw,
  formatter,
  fallback,
}: {
  raw: number;
  formatter: (n: number) => string;
  fallback: string;
}) {
  const animated = useCountUp(raw);
  if (Number.isNaN(raw)) return <>{fallback}</>;
  return <>{formatter(animated)}</>;
}

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
  highlight = false,
  rawValue,
  formatter,
  animationDelay,
}: StatCardProps) {
  const hasAnimation = rawValue !== undefined && formatter !== undefined;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-500",
        highlight && "border-primary/30 bg-gradient-to-br from-primary/10 to-card",
      )}
      style={animationDelay !== undefined ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      {highlight && (
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500" />
      )}
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p
              className={cn(
                "mt-2 text-2xl font-bold tracking-tight tabular-nums",
                highlight ? "text-foreground" : toneValueClasses[tone],
              )}
            >
              {hasAnimation ? (
                <AnimatedValue raw={rawValue} formatter={formatter} fallback={value} />
              ) : (
                value
              )}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">{detail}</p>
          </div>
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneIconClasses[tone])}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
