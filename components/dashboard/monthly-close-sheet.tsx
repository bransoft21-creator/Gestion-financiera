"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { ContextualEducationCard } from "@/components/education/contextual-education-card";
import { getMonthlyCloseEducation } from "@/lib/finance/contextual-education";
import { captureClientError, trackProductEvent } from "@/lib/observability/client";
import type { MonthlyCloseData } from "@/app/api/monthly-close/route";

/* ── Formatters ────────────────────────────────────────────────────────────── */

function formatARS(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  }
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatAvailableChange(delta: number): { text: string; positive: boolean } {
  const abs = formatARS(Math.abs(delta));
  if (delta > 0) return { text: `${abs} más que el mes anterior`, positive: true };
  return { text: `${abs} menos que el mes anterior`, positive: false };
}

/* ── Tone helpers ──────────────────────────────────────────────────────────── */

const SIGNAL_DOT: Record<string, string> = {
  positive: "bg-teal-400",
  neutral: "bg-muted-foreground/50",
  warning: "bg-amber-400",
};

/* ── AI Summary section ────────────────────────────────────────────────────── */

type AiStatus = "idle" | "loading" | "done" | "unavailable";

interface AiSummaryItem {
  text: string;
  tone: "positive" | "neutral" | "warning";
}

function MonthlyAiSection({ monthKey }: { monthKey: string }) {
  const [status, setStatus] = useState<AiStatus>("loading");
  const [items, setItems] = useState<AiSummaryItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Try cached analysis first — no AI cost
        const res = await fetch(`/api/ai/monthly-analysis?month=${monthKey}`);
        if (res.status === 403 || res.status === 401) {
          if (!cancelled) setStatus("unavailable");
          return;
        }

        if (res.ok) {
          const json = (await res.json()) as {
            data?: {
              analysis?: {
                summary?: string;
                positivePoints?: Array<{ title: string; message: string }>;
                alerts?: Array<{ severity: string; title: string; message: string }>;
              };
            } | null;
          };
          const analysis = json.data?.analysis;
          if (analysis) {
            const collected: AiSummaryItem[] = [];
            if (analysis.summary) {
              collected.push({ text: analysis.summary, tone: "neutral" });
            }
            const highAlert = analysis.alerts?.find((a) => a.severity === "high" || a.severity === "medium");
            if (highAlert) {
              collected.push({ text: highAlert.message, tone: "warning" });
            } else if (analysis.positivePoints?.[0]) {
              collected.push({ text: analysis.positivePoints[0].message, tone: "positive" });
            }
            if (!cancelled && collected.length > 0) {
              setItems(collected);
              setStatus("done");
              return;
            }
          }
        }

        // No cache — generate
        const genRes = await fetch("/api/ai/monthly-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month: monthKey }),
        });
        if (!genRes.ok || genRes.status === 403) {
          if (!cancelled) setStatus("unavailable");
          return;
        }
        const genJson = (await genRes.json()) as {
          data?: {
            analysis?: {
              summary?: string;
              positivePoints?: Array<{ title: string; message: string }>;
              alerts?: Array<{ severity: string; title: string; message: string }>;
            };
          } | null;
        };
        const analysis = genJson.data?.analysis;
        if (!cancelled) {
          if (analysis?.summary) {
            const collected: AiSummaryItem[] = [{ text: analysis.summary, tone: "neutral" }];
            const highAlert = analysis.alerts?.find((a) => a.severity === "high" || a.severity === "medium");
            if (highAlert) collected.push({ text: highAlert.message, tone: "warning" });
            else if (analysis.positivePoints?.[0]) collected.push({ text: analysis.positivePoints[0].message, tone: "positive" });
            setItems(collected);
            setStatus("done");
          } else {
            setStatus("unavailable");
          }
        }
      } catch (err) {
        captureClientError(err, "ai", { reason: "monthly_close_ai" });
        if (!cancelled) setStatus("unavailable");
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [monthKey]);

  if (status === "unavailable") return null;

  const DOT_COLOR: Record<string, string> = {
    positive: "bg-teal-400",
    neutral: "bg-muted-foreground/50",
    warning: "bg-amber-400",
  };

  return (
    <div className="pt-1">
      <div className="mb-3 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 shrink-0 text-teal-400" aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Contexto
        </span>
      </div>
      {status === "loading" ? (
        <div className="space-y-2">
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-4/5 rounded" />
          <Skeleton className="h-3 w-3/5 rounded" />
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className={cn("mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full", DOT_COLOR[item.tone] ?? "bg-muted-foreground/50")}
                aria-hidden="true"
              />
              <span className="text-sm leading-snug text-muted-foreground">{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Portal helpers ────────────────────────────────────────────────────────── */

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

interface MonthlyCloseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  close: MonthlyCloseData;
}

export function MonthlyCloseSheet({ isOpen, onClose, close }: MonthlyCloseSheetProps) {
  const isMounted = useClientMounted();
  useLockBodyScroll(isOpen);
  const didTrack = useRef(false);

  useEffect(() => {
    if (isOpen && !didTrack.current) {
      didTrack.current = true;
      trackProductEvent(
        "monthly_close_viewed",
        { tone: close.overallTone, signalCount: close.signals.length },
        "dashboard",
      );
    }
    if (!isOpen) didTrack.current = false;
  }, [isOpen, close]);

  const handleDismiss = useCallback(() => {
    trackProductEvent("monthly_close_dismissed", { tone: close.overallTone }, "dashboard");
    onClose();
  }, [close.overallTone, onClose]);

  if (!isMounted || !isOpen) return null;

  const availableChange =
    close.availableVsPrev !== null ? formatAvailableChange(close.availableVsPrev) : null;

  const availablePositive = close.available >= 0;
  const education = getMonthlyCloseEducation(close.signals);

  const content = (
    <div>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[125] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Cierre de ${close.monthLabel}`}
        className="fixed inset-x-0 bottom-0 z-[130] flex max-h-[90dvh] flex-col rounded-t-2xl border-t border-border bg-card/[0.98] shadow-2xl animate-in slide-in-from-bottom duration-300 pb-[env(safe-area-inset-bottom)]"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4 pt-2 shrink-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Cierre de mes
            </p>
            <p className="text-sm font-medium capitalize text-foreground">{close.monthLabel}</p>
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">

          {/* Disponible real */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Disponible real al cierre
            </p>
            <p
              className={cn(
                "text-2xl font-bold tabular-nums",
                availablePositive ? "text-foreground" : "text-amber-400",
              )}
            >
              <SensitiveAmount value={formatARS(close.available)} />
            </p>
            {availableChange && (
              <p
                className={cn(
                  "mt-1.5 text-sm font-medium",
                  availableChange.positive ? "text-teal-400" : "text-muted-foreground",
                )}
              >
                {availableChange.text}
              </p>
            )}
            {/* Expense context */}
            <p className="mt-2 text-xs text-muted-foreground">
              <SensitiveAmount value={formatARS(close.expenses)} /> en gastos
              {close.income > 0 && (
                <> · <SensitiveAmount value={formatARS(close.income)} /> en ingresos</>
              )}
            </p>
          </div>

          {/* Señales (max 2) */}
          {close.signals.length > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Para tener en cuenta
              </p>
              <ul className="space-y-2.5">
                {close.signals.slice(0, 2).map((signal) => (
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

          <ContextualEducationCard item={education} surface="monthly-close" compact />

          {/* Contexto IA (lazy) */}
          <MonthlyAiSection monthKey={close.monthKey} />
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-5 py-4">
          <Button variant="default" className="w-full" onClick={handleDismiss}>
            Entendido
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
