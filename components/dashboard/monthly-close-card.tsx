"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  const firstSignal = close.signals[0];
  if (firstSignal) return firstSignal.label;
  if (close.available >= 0) return "El mes cerró con disponible real positivo";
  return "El mes cerró con disponible ajustado";
}

/* ── Main component ────────────────────────────────────────────────────────── */

type Status = "idle" | "loading" | "done" | "insufficient" | "error";

export function MonthlyCloseCard() {
  const dayOfMonth = new Date().getDate();
  const shouldShow = dayOfMonth <= 10;
  const [status, setStatus] = useState<Status>(shouldShow ? "loading" : "idle");
  const [close, setClose] = useState<MonthlyCloseData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Only show during the first 10 days of the month — after that, the user
  // has had enough time to process the close and the card becomes noise.
  useEffect(() => {
    if (!shouldShow) return;
    let cancelled = false;

    fetch("/api/monthly-close")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: { data?: MonthlyCloseData | null }) => {
        if (cancelled) return;
        const d = json.data;
        if (!d || !d.hasData) {
          setStatus("insufficient");
          return;
        }
        setClose(d);
        setStatus("done");
      })
      .catch((err) => {
        captureClientError(err, "dashboard", { reason: "monthly_close_fetch" });
        if (!cancelled) setStatus("error");
      });

    return () => { cancelled = true; };
  }, [shouldShow]);

  // Hidden after day 10 — intentional design
  if (status === "idle") return null;

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

  if (status === "insufficient") {
    return (
      <div className="mb-3 rounded-2xl border border-border bg-muted/15 px-5 py-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Cierre de mes
          </span>
        </div>
        <p className="pl-4 text-sm text-muted-foreground leading-snug">
          Todavía no hay suficiente información para armar tu cierre del mes anterior.
        </p>
        <div className="pl-4 mt-2.5 flex items-center gap-3">
          <Link
            href="/transactions?new=1"
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            Registrar movimiento →
          </Link>
          <span className="text-muted-foreground/40">·</span>
          <Link
            href="/smart-import"
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            Importar Excel →
          </Link>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mb-3 rounded-2xl border border-border bg-muted/15 px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Cierre de mes
          </span>
        </div>
        <p className="pl-4 text-sm text-muted-foreground">
          No se pudo cargar el cierre. Recargá la página para intentar de nuevo.
        </p>
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
