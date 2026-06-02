"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PeriodStatus } from "@/lib/period-status";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

const STATUS_CONFIG: Record<PeriodStatus, { label: string; className: string }> = {
  OPEN: {
    label: "En curso",
    className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-400",
  },
  CLOSED: {
    label: "Cerrado",
    className: "border-border bg-muted/40 text-muted-foreground",
  },
  FUTURE: {
    label: "Próximo",
    className: "border-sky-400/25 bg-sky-400/10 text-sky-400",
  },
};

export function PeriodSelector({
  year,
  month,
  status,
  onPrev,
  onNext,
}: {
  year: number;
  month: number;
  status: PeriodStatus;
  onPrev: () => void;
  onNext: () => void;
}) {
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="flex items-center justify-between rounded-[1.25rem] border border-border/60 bg-card/80 px-4 py-3">
      <button
        type="button"
        onClick={onPrev}
        className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/50 hover:text-foreground active:scale-95"
        aria-label="Mes anterior"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="flex items-center gap-2.5">
        <span className="text-sm font-semibold text-foreground">
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none", cfg.className)}>
          {cfg.label}
        </span>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/50 hover:text-foreground active:scale-95"
        aria-label="Mes siguiente"
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
