"use client";

import Link from "next/link";
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
  href?: string;
};

const toneConfig = {
  default: {
    icon: "bg-sky-500/15 text-sky-400",
    value: "text-sky-400",
    line: "from-sky-500/60 via-sky-500/20 to-transparent",
  },
  positive: {
    icon: "bg-emerald-500/15 text-emerald-400",
    value: "text-emerald-400",
    line: "from-emerald-500/60 via-emerald-500/20 to-transparent",
  },
  warning: {
    icon: "bg-amber-500/15 text-amber-400",
    value: "text-amber-400",
    line: "from-amber-500/60 via-amber-500/20 to-transparent",
  },
  danger: {
    icon: "bg-rose-500/15 text-rose-400",
    value: "text-rose-400",
    line: "from-rose-500/60 via-rose-500/20 to-transparent",
  },
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
  href,
}: StatCardProps) {
  const hasAnimation = rawValue !== undefined && formatter !== undefined;
  const config = toneConfig[tone];
  const content = (
    <Card
      className={cn(
        "relative overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-500",
        href && "cursor-pointer transition hover:-translate-y-0.5 hover:border-primary/35",
        highlight && "border-teal-300/30 bg-teal-300/10",
      )}
      style={animationDelay !== undefined ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-px bg-gradient-to-r",
          highlight ? "from-teal-300/80 via-amber-200/35 to-transparent" : config.line,
        )}
      />

      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p
              className={cn(
                "mt-2 text-2xl font-bold tracking-tight tabular-nums",
                highlight ? "text-foreground" : config.value,
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
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", config.icon)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!href) return content;

  return (
    <Link href={href} aria-label={label} className="block min-w-0">
      {content}
    </Link>
  );
}
