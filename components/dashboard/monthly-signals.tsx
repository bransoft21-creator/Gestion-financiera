"use client";

import Link from "next/link";
import { AlertTriangle, Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PremiumCard,
  PremiumCardContent,
} from "@/components/ui-v2/premium-card";
import type { DashboardSummary } from "@/app/(private)/dashboard/types";

const insightToneConfig = {
  default: {
    shell: "border-sky-500/20 bg-sky-500/10",
    icon: "bg-sky-500/15 text-sky-400",
    label: "text-sky-400",
  },
  positive: {
    shell: "border-emerald-500/20 bg-emerald-500/10",
    icon: "bg-emerald-500/15 text-emerald-400",
    label: "text-emerald-400",
  },
  warning: {
    shell: "border-amber-500/20 bg-amber-500/10",
    icon: "bg-amber-500/15 text-amber-400",
    label: "text-amber-400",
  },
  danger: {
    shell: "border-rose-500/20 bg-rose-500/10",
    icon: "bg-rose-500/15 text-rose-400",
    label: "text-rose-400",
  },
};

export function MonthlySignals({
  insights,
  alerts,
}: {
  insights: DashboardSummary["insights"];
  alerts: string[];
}) {
  if (!insights.length && !alerts.length) return null;

  const [primary, ...secondary] = insights;
  const fallback = alerts[0]
    ? {
        title: "Revisá el mes",
        message: alerts[0],
        tone: "warning" as const,
        actionLabel: "Ver transacciones",
        href: "/transactions",
      }
    : null;
  const signal = primary ?? fallback;

  if (!signal) return null;

  const primaryTone = insightToneConfig[signal.tone];

  return (
    <PremiumCard className="flex h-full flex-col">
      <PremiumCardContent className="flex h-full flex-col space-y-3 pt-4 sm:pt-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Lightbulb className="h-3 w-3 shrink-0" aria-hidden="true" />
          Lo que importa hoy
        </div>
        <div className={`flex-1 rounded-2xl border p-4 ${primaryTone.shell}`}>
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${primaryTone.icon}`}
            >
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight text-foreground">{signal.title}</h3>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{signal.message}</p>
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="mt-2 h-7 px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
              >
                <Link href={signal.href}>{signal.actionLabel} →</Link>
              </Button>
            </div>
          </div>
        </div>

        {secondary.length > 0 && (
          <div className="space-y-1">
            {secondary.slice(0, 2).map((insight) => {
              const tone = insightToneConfig[insight.tone];
              return (
                <Link
                  key={`${insight.title}-${insight.href}`}
                  href={insight.href}
                  className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <Sparkles className={`h-3 w-3 shrink-0 ${tone.label}`} aria-hidden="true" />
                  <span className="truncate">{insight.title}</span>
                </Link>
              );
            })}
          </div>
        )}
        {alerts.slice(0, 1).map((alert) => (
          <div
            key={alert}
            className="flex gap-2 rounded-xl border border-amber-500/12 bg-amber-500/[0.07] px-3 py-2"
          >
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-hidden="true" />
            <p className="text-xs leading-5 text-muted-foreground">{alert}</p>
          </div>
        ))}
      </PremiumCardContent>
    </PremiumCard>
  );
}
