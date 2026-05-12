"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReflectionInsight } from "@/lib/finance/ai-financial-reflection";

type ApiResponse = {
  data?: {
    insights: ReflectionInsight[];
    weekLabel: string;
    cached: boolean;
    hasData: boolean;
  } | null;
  error?: string;
};

type Status = "idle" | "loading" | "done" | "empty" | "error";

const TONE_DOT: Record<ReflectionInsight["tone"], string> = {
  positive: "bg-teal-400",
  neutral:  "bg-zinc-500",
  warning:  "bg-amber-400",
};

const TONE_TEXT: Record<ReflectionInsight["tone"], string> = {
  positive: "text-zinc-200",
  neutral:  "text-zinc-400",
  warning:  "text-zinc-200",
};

export function WeeklyReflectionCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [insights, setInsights] = useState<ReflectionInsight[]>([]);
  const [weekLabel, setWeekLabel] = useState<string>("");

  const generate = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/ai/weekly-reflection", { method: "POST" });
      if (res.status === 403) { setStatus("empty"); return; }
      if (!res.ok) { setStatus("error"); return; }
      const json = (await res.json()) as ApiResponse;
      const d = json.data;
      if (!d || !d.hasData || d.insights.length === 0) { setStatus("empty"); return; }
      setInsights(d.insights);
      setWeekLabel(d.weekLabel);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setStatus("loading");
      try {
        // Try reading cached first (no AI cost)
        const res = await fetch("/api/ai/weekly-reflection");
        if (res.status === 403) { if (!cancelled) setStatus("empty"); return; }

        if (res.ok) {
          const json = (await res.json()) as ApiResponse;
          const d = json.data;
          if (d && d.hasData && d.insights.length > 0) {
            if (!cancelled) {
              setInsights(d.insights);
              setWeekLabel(d.weekLabel);
              setStatus("done");
            }
            return;
          }
        }

        // No cache — generate
        if (!cancelled) await generate();
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void init();
    return () => { cancelled = true; };
  }, [generate]);

  // Don't render noise states
  if (status === "empty" || status === "error" || status === "idle") return null;

  if (status === "loading") {
    return (
      <div className="mb-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded-full" />
          <Skeleton className="h-3 w-28 rounded" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-4/5 rounded" />
          <Skeleton className="h-3 w-3/5 rounded" />
          <Skeleton className="h-3 w-2/3 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-teal-400" aria-hidden="true" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            Tu semana
          </span>
        </div>
        {weekLabel && (
          <span className="text-[11px] text-zinc-600">{weekLabel}</span>
        )}
      </div>

      {/* Insights */}
      <ul className="space-y-1.5">
        {insights.map((insight, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className={cn("mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[insight.tone])}
              aria-hidden="true"
            />
            <span className={cn("text-sm leading-snug", TONE_TEXT[insight.tone])}>
              {insight.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
