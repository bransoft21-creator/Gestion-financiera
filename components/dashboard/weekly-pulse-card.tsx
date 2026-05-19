"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { captureClientError } from "@/lib/observability/client";
import { WeeklyPulseSheet } from "./weekly-pulse-sheet";
import type { WeeklyPulseData } from "@/app/api/weekly-pulse/route";

/* ── Tone indicator ────────────────────────────────────────────────────────── */

const TONE_DOT: Record<string, string> = {
  positive: "bg-teal-400",
  neutral: "bg-muted-foreground/60",
  warning: "bg-amber-400",
};

/* ── Preview label from pulse data ────────────────────────────────────────── */

function isEarlyWeek(pulse: WeeklyPulseData): boolean {
  return pulse.daysElapsed <= 2 && pulse.transactionCount < 3;
}

function buildPreviewText(pulse: WeeklyPulseData): string {
  if (!pulse.hasData) return "Sin movimientos registrados esta semana";

  if (isEarlyWeek(pulse)) {
    return pulse.transactionCount > 0
      ? `${pulse.transactionCount} movimiento${pulse.transactionCount !== 1 ? "s" : ""} por ahora`
      : "La semana acaba de empezar";
  }

  const firstSignal = pulse.signals[0];
  if (firstSignal) return firstSignal.label;

  if (pulse.expensesChange !== null) {
    const abs = Math.abs(Math.round(pulse.expensesChange));
    if (pulse.expensesChange < -10) return `Flujo ${abs}% menor que la semana anterior`;
    if (pulse.expensesChange > 40) return "Semana con más movimiento que la anterior";
    return "Ritmo similar a la semana anterior";
  }

  return `${pulse.transactionCount} movimiento${pulse.transactionCount !== 1 ? "s" : ""} esta semana`;
}

/* ── Main component ────────────────────────────────────────────────────────── */

type Status = "idle" | "loading" | "done" | "empty";

export function WeeklyPulseCard() {
  const [status, setStatus] = useState<Status>("loading");
  const [pulse, setPulse] = useState<WeeklyPulseData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/weekly-pulse")
      .then((r) => r.json())
      .then((json: { data?: WeeklyPulseData | null }) => {
        if (cancelled) return;
        const d = json.data;
        if (!d || !d.hasData) {
          setStatus("empty");
          return;
        }
        setPulse(d);
        setStatus("done");
      })
      .catch((err) => {
        captureClientError(err, "dashboard", { reason: "weekly_pulse_fetch" });
        if (!cancelled) setStatus("empty");
      });

    return () => { cancelled = true; };
  }, []);

  if (status === "empty" || status === "idle") return null;

  if (status === "loading") {
    return (
      <div className="mb-3 rounded-2xl border border-border bg-muted/20 px-5 py-4">
        <div className="mb-2 flex items-center gap-2">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="ml-auto h-3 w-10 rounded" />
        </div>
        <Skeleton className="h-3 w-3/5 rounded" />
      </div>
    );
  }

  if (!pulse) return null;

  const previewText = buildPreviewText(pulse);
  const dotClass = TONE_DOT[pulse.overallTone] ?? "bg-muted-foreground/60";

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className={cn(
          "mb-3 w-full rounded-2xl border border-border bg-muted/15 px-5 py-4 text-left",
          "transition-colors hover:bg-muted/25 active:bg-muted/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-label={`Ver pulso semanal: ${pulse.weekLabel}`}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Label + dot */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)}
              aria-hidden="true"
            />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">
              Tu semana
            </span>
            <span className="text-[10px] text-muted-foreground/70 truncate">
              · {pulse.weekLabel}
            </span>
          </div>
          {/* CTA */}
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
            ver →
          </span>
        </div>

        {/* Preview signal */}
        <p className="mt-1.5 text-sm leading-snug text-muted-foreground line-clamp-1 pl-4">
          {previewText}
        </p>
      </button>

      {sheetOpen && pulse && (
        <WeeklyPulseSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          pulse={pulse}
        />
      )}
    </>
  );
}
