"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { captureClientError } from "@/lib/observability/client";
import { MonthlyCloseSheet } from "./monthly-close-sheet";
import type { MonthlyCloseData } from "@/app/api/monthly-close/route";

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

  const isPositive = close.overallTone !== "warning";
  const previewText = buildPreviewText(close);

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className={cn(
          "mb-4 w-full rounded-2xl border text-left transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isPositive
            ? "border-emerald-500/15 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.07]"
            : "border-amber-400/15 bg-amber-400/[0.04] hover:bg-amber-400/[0.07]",
        )}
        aria-label={`Ver cierre de ${close.monthLabel}`}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              isPositive ? "bg-emerald-500/10" : "bg-amber-400/10",
            )}
          >
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                isPositive ? "bg-emerald-400" : "bg-amber-400",
              )}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="text-[13px] font-semibold text-foreground">
                Cierre de {close.monthLabel}
              </p>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  isPositive
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-amber-400/10 text-amber-500",
                )}
              >
                {isPositive ? "positivo" : "revisar"}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">
              {previewText}
            </p>
          </div>
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
            Ritual →
          </span>
        </div>
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
