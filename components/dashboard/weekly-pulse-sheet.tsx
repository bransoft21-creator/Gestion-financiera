"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ContextualEducationCard } from "@/components/education/contextual-education-card";
import { getWeeklyPulseEducation } from "@/lib/finance/contextual-education";
import { captureClientError, trackProductEvent } from "@/lib/observability/client";
import type { WeeklyPulseData } from "@/app/api/weekly-pulse/route";
import type { ReflectionInsight } from "@/lib/finance/ai-financial-reflection";

/* ── Tone helpers ──────────────────────────────────────────────────────────── */

const SIGNAL_DOT: Record<string, string> = {
  positive: "bg-teal-400",
  neutral: "bg-muted-foreground/50",
  warning: "bg-amber-400",
};

/* ── Formatting ────────────────────────────────────────────────────────────── */

function formatARS(n: number): string {
  if (n >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  }
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatChangePct(pct: number): { text: string; positive: boolean } {
  const abs = Math.abs(Math.round(pct));
  if (pct < 0) return { text: `↓ ${abs}% menos que la semana anterior`, positive: true };
  if (pct > 0) return { text: `↑ ${abs}% más que la semana anterior`, positive: false };
  return { text: "igual que la semana anterior", positive: true };
}

/* ── AI Insights section ───────────────────────────────────────────────────── */

const AI_TONE_DOT: Record<ReflectionInsight["tone"], string> = {
  positive: "bg-teal-400",
  neutral: "bg-muted-foreground/50",
  warning: "bg-amber-400",
};

type AiStatus = "idle" | "loading" | "done" | "unavailable";

function AiInsightsSection() {
  const [status, setStatus] = useState<AiStatus>("idle");
  const [insights, setInsights] = useState<ReflectionInsight[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      try {
        // Try cached first
        const res = await fetch("/api/ai/weekly-reflection");
        if (res.status === 403 || res.status === 401) {
          if (!cancelled) setStatus("unavailable");
          return;
        }
        if (res.ok) {
          const json = (await res.json()) as { data?: { insights: ReflectionInsight[]; hasData: boolean } | null };
          const d = json.data;
          if (d && d.hasData && d.insights.length > 0) {
            if (!cancelled) { setInsights(d.insights); setStatus("done"); }
            return;
          }
        }

        // Generate if no cache
        const genRes = await fetch("/api/ai/weekly-reflection", { method: "POST" });
        if (!genRes.ok || genRes.status === 403) {
          if (!cancelled) setStatus("unavailable");
          return;
        }
        const genJson = (await genRes.json()) as { data?: { insights: ReflectionInsight[]; hasData: boolean } | null };
        const d = genJson.data;
        if (!cancelled) {
          if (d && d.hasData && d.insights.length > 0) {
            setInsights(d.insights);
            setStatus("done");
          } else {
            setStatus("unavailable");
          }
        }
      } catch (err) {
        captureClientError(err, "ai", { reason: "weekly_pulse_ai" });
        if (!cancelled) setStatus("unavailable");
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  if (status === "unavailable") return null;

  return (
    <div className="pt-4">
      <div className="mb-3 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 shrink-0 text-teal-400" aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Contexto
        </span>
      </div>

      {status === "loading" ? (
        <div className="space-y-2">
          <Skeleton className="h-3 w-4/5 rounded" />
          <Skeleton className="h-3 w-3/5 rounded" />
          <Skeleton className="h-3 w-2/3 rounded" />
        </div>
      ) : (
        <ul className="space-y-2">
          {insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className={cn("mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full", AI_TONE_DOT[insight.tone])}
                aria-hidden="true"
              />
              <span className="text-sm leading-snug text-muted-foreground">{insight.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Sheet overlay & panel ─────────────────────────────────────────────────── */

function useClientMounted() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}

/* ── Main export ───────────────────────────────────────────────────────────── */

interface WeeklyPulseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  pulse: WeeklyPulseData;
}

export function WeeklyPulseSheet({ isOpen, onClose, pulse }: WeeklyPulseSheetProps) {
  const isMounted = useClientMounted();
  useLockBodyScroll(isOpen);
  const didTrack = useRef(false);

  useEffect(() => {
    if (isOpen && !didTrack.current) {
      didTrack.current = true;
      trackProductEvent(
        "weekly_pulse_viewed",
        { tone: pulse.overallTone, signalCount: pulse.signals.length },
        "dashboard",
      );
    }
    if (!isOpen) didTrack.current = false;
  }, [isOpen, pulse]);

  function handleDismiss() {
    trackProductEvent("weekly_pulse_dismissed", { tone: pulse.overallTone }, "dashboard");
    onClose();
  }

  if (!isMounted || !isOpen) return null;

  const changeInfo =
    pulse.expensesChange !== null ? formatChangePct(pulse.expensesChange) : null;
  const education = getWeeklyPulseEducation(pulse.signals);

  const content = (
    <div>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Sheet panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Tu semana · ${pulse.weekLabel}`}
        className="fixed inset-x-0 bottom-0 z-[100] flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-border bg-card/[0.98] shadow-2xl animate-in slide-in-from-bottom duration-300 pb-[env(safe-area-inset-bottom)]"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 pt-2 shrink-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Tu semana
            </p>
            <p className="text-sm font-medium text-foreground">{pulse.weekLabel}</p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted/50"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Divider */}
        <div className="h-px shrink-0 bg-border mx-5" />

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-5">

          {/* Movimiento semanal */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Movimiento semanal
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {formatARS(pulse.totalExpenses)}
            </p>
            {pulse.transactionCount > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {pulse.transactionCount} movimiento{pulse.transactionCount !== 1 ? "s" : ""}
                {pulse.topCategory ? ` · ${pulse.topCategory.name} fue lo principal` : ""}
              </p>
            )}
            {changeInfo && (
              <p
                className={cn(
                  "mt-2 text-sm font-medium",
                  changeInfo.positive ? "text-teal-400" : "text-amber-400",
                )}
              >
                {changeInfo.text}
              </p>
            )}
          </div>

          {/* Señales (max 2) */}
          {pulse.signals.length > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Para tener en cuenta
              </p>
              <ul className="space-y-2.5">
                {pulse.signals.map((signal) => (
                  <li key={signal.id} className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full",
                        SIGNAL_DOT[signal.severity] ?? "bg-muted-foreground/50",
                      )}
                      aria-hidden="true"
                    />
                    <span className="text-sm leading-snug text-muted-foreground">{signal.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ContextualEducationCard item={education} surface="weekly-pulse" compact />

          {/* Contexto IA (lazy — maneja 403 internamente) */}
          <AiInsightsSection />
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-5 py-4">
          <Button
            variant="default"
            className="w-full"
            onClick={handleDismiss}
          >
            Entendido
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
