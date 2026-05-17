"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { captureClientError } from "@/lib/observability/client";
import { MonthlyCloseSheet } from "./monthly-close-sheet";
import type { MonthlyCloseData } from "@/app/api/monthly-close/route";

/* ── Tone dot ──────────────────────────────────────────────────────────────── */

const TONE_DOT: Record<string, string> = {
  positive: "bg-teal-400",
  neutral: "bg-muted-foreground/60",
  warning: "bg-amber-400",
};

/* ── Preview line ──────────────────────────────────────────────────────────── */

function buildPreviewText(close: MonthlyCloseData): string {
  if (!close.hasData) return "Sin datos registrados para el mes anterior";

  const firstSignal = close.signals[0];
  if (firstSignal) return firstSignal.label;

  if (close.available >= 0) return "El mes cerró con disponible real positivo";
  return "El mes cerró con disponible ajustado";
}

/* ── Main component ────────────────────────────────────────────────────────── */

type Status = "idle" | "loading" | "done" | "empty";

export function MonthlyCloseCard() {
  const [status, setStatus] = useState<Status>("idle");
  const [close, setClose] = useState<MonthlyCloseData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Only show during the first 10 days of the month — after that, the user
  // has had enough time to process the close and the card becomes noise.
  const dayOfMonth = new Date().getDate();
  if (dayOfMonth > 10) return null;

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    fetch("/api/monthly-close")
      .then((r) => r.json())
      .then((json: { data?: MonthlyCloseData | null }) => {
        if (cancelled) return;
        const d = json.data;
        if (!d || !d.hasData) {
          setStatus("empty");
          return;
        }
        setClose(d);
        setStatus("done");
      })
      .catch((err) => {
        captureClientError(err, "dashboard", { reason: "monthly_close_fetch" });
        if (!cancelled) setStatus("empty");
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "empty" || status === "idle") return null;

  if (status === "loading") {
    return (
      <div className="mb-3 rounded-2xl border border-border bg-muted/20 px-5 py-4">
        <div className="mb-2 flex items-center gap-2">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-3 w-28 rounded" />
          <Skeleton className="ml-auto h-3 w-10 rounded" />
        </div>
        <Skeleton className="h-3 w-3/5 rounded" />
      </div>
    );
  }

  if (!close) return null;

  const dotClass = TONE_DOT[close.overallTone] ?? "bg-muted-foreground/60";
  const previewText = buildPreviewText(close);

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
        aria-label={`Ver cierre de ${close.monthLabel}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)}
              aria-hidden="true"
            />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">
              Cierre de mes
            </span>
            <span className="text-[10px] text-muted-foreground/70 truncate capitalize">
              · {close.monthLabel}
            </span>
          </div>
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
            ver →
          </span>
        </div>

        <p className="mt-1.5 text-sm leading-snug text-muted-foreground line-clamp-1 pl-4">
          {previewText}
        </p>
      </button>

      {sheetOpen && close && (
        <MonthlyCloseSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          close={close}
        />
      )}
    </>
  );
}
