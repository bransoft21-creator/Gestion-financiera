"use client";

import Link from "next/link";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { cn } from "@/lib/utils";
import { buildHealthSignals } from "@/app/(private)/dashboard/utils";
import type { DashboardSummary, InsightCardTone } from "@/app/(private)/dashboard/types";

const metricAmountColor: Record<InsightCardTone, string> = {
  positive: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-rose-400",
  neutral: "text-foreground",
  info: "text-sky-400",
};

const metricDotColor: Record<InsightCardTone, string> = {
  positive: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  neutral: "bg-muted-foreground",
  info: "bg-sky-500",
};

export function MetricStrip({
  items,
}: {
  items: Array<{ label: string; value: string; tone: InsightCardTone; href: string }>;
}) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-muted/30 sm:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="flex flex-col gap-1.5 bg-card px-4 py-3.5 transition hover:bg-muted/50"
        >
          <div className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", metricDotColor[item.tone])} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {item.label}
            </span>
          </div>
          <p className={cn("truncate text-sm font-semibold tabular-nums", metricAmountColor[item.tone])}>
            <SensitiveAmount value={item.value} />
          </p>
        </Link>
      ))}
    </div>
  );
}

export function FinancialHealthStrip({ metrics }: { metrics: DashboardSummary["metrics"] }) {
  const signals = buildHealthSignals(metrics);
  if (!signals.length) return null;

  return (
    <div className="mb-10 flex flex-wrap gap-1.5 sm:mb-12">
      {signals.map((signal) => (
        <div
          key={signal.label}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
            signal.tone === "positive"
              ? "border-emerald-500/12 bg-emerald-500/[0.07] text-emerald-500"
              : "border-amber-500/12 bg-amber-500/[0.07] text-amber-500",
          )}
        >
          <span
            className={cn(
              "h-1 w-1 shrink-0 rounded-full",
              signal.tone === "positive" ? "bg-emerald-500" : "bg-amber-500",
            )}
          />
          {signal.label}
        </div>
      ))}
    </div>
  );
}
