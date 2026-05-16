"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BrainCircuit,
  CheckCheck,
  CheckCircle2,
  Lightbulb,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PremiumCard, PremiumCardContent } from "@/components/ui-v2/premium-card";
import type { ActivityType, ActivityTone } from "@prisma/client";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ───────────────────────────────────────────────────────────────────

type ActivityItem = {
  id: string;
  type: ActivityType;
  tone: ActivityTone;
  priority: number;
  title: string;
  body: string;
  periodKey: string | null;
  actionLabel: string | null;
  actionLink: string | null;
  readAt: string | null;
  dismissedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

type ApiResponse = {
  data?: { items: ActivityItem[] } | null;
  error?: string;
};

type Filter = "all" | "important" | "positive" | "pending" | "archived";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all",       label: "Todas" },
  { id: "important", label: "Importantes" },
  { id: "positive",  label: "Positivas" },
  { id: "pending",   label: "Pendientes" },
  { id: "archived",  label: "Archivadas" },
];

// ── Visual maps ──────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<ActivityType, string> = {
  INSIGHT:  "Insight IA",
  SIGNAL:   "Señal",
  REMINDER: "Recordatorio",
  SYSTEM:   "Sistema",
};

const TYPE_ICON: Record<ActivityType, typeof Bell> = {
  INSIGHT:  Sparkles,
  SIGNAL:   BrainCircuit,
  REMINDER: Bell,
  SYSTEM:   CheckCircle2,
};

const TONE: Record<ActivityTone, { dot: string; border: string; bg: string; text: string; label: string }> = {
  positive: {
    dot:    "bg-teal-400",
    border: "border-teal-300/20",
    bg:     "bg-teal-300/[0.04]",
    text:   "text-teal-300",
    label:  "text-teal-400",
  },
  neutral: {
    dot:    "bg-zinc-500",
    border: "border-border",
    bg:     "bg-muted/20",
    text:   "text-muted-foreground",
    label:  "text-muted-foreground",
  },
  warning: {
    dot:    "bg-amber-400",
    border: "border-amber-300/20",
    bg:     "bg-amber-300/[0.04]",
    text:   "text-amber-200",
    label:  "text-amber-400",
  },
};

const PRIORITY_LABELS = [
  { min: 2, label: "Prioritario", className: "border-amber-300/25 bg-amber-300/10 text-amber-200" },
  { min: 1, label: "Atención", className: "border-teal-300/20 bg-teal-300/10 text-teal-200" },
];

// ── Relative time ────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ayer";
  if (days < 8) return `hace ${days} días`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

// ── ActivityCard ─────────────────────────────────────────────────────────────

function ActivityCard({
  item,
  onRead,
  onResolve,
  onDismiss,
}: {
  item: ActivityItem;
  onRead: (id: string) => void;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const tone = TONE[item.tone];
  const Icon = TYPE_ICON[item.type];
  const isRead = !!item.readAt;
  const isResolved = !!item.resolvedAt;
  const priority = PRIORITY_LABELS.find((p) => item.priority >= p.min);

  return (
    <div
      className={cn(
        "group relative rounded-2xl border p-4 transition-opacity duration-200",
        tone.border,
        tone.bg,
        (isRead || isResolved) && "opacity-60",
      )}
    >
      {/* Priority dot */}
      {item.priority >= 1 && (
        <span className="absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-amber-400" />
      )}

      <div className="flex items-start gap-3">
        {/* Tone dot */}
        <span className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)} aria-hidden="true" />

        <div className="min-w-0 flex-1">
          {/* Meta row */}
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={cn("flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider", tone.label)}>
              <Icon className="h-3 w-3" aria-hidden="true" />
              {TYPE_LABEL[item.type]}
            </span>
            {priority && (
              <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", priority.className)}>
                {priority.label}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">{relativeTime(item.createdAt)}</span>
          </div>

          {/* Title */}
          <p className="text-sm font-semibold leading-snug text-foreground">{item.title}</p>

          {/* Body */}
          <p className={cn("mt-1 text-sm leading-5", tone.text)}>{item.body}</p>

          {/* Actions */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {item.actionLabel && item.actionLink && (
              <Link
                href={item.actionLink}
                className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {item.actionLabel} →
              </Link>
            )}
            {!isRead && (
              <button
                type="button"
                onClick={() => onRead(item.id)}
                className="text-xs text-muted-foreground hover:text-muted-foreground"
              >
                Marcar leída
              </button>
            )}
            {!isResolved && item.dismissedAt === null && (
              <button
                type="button"
                onClick={() => onResolve(item.id)}
                className="text-xs text-muted-foreground hover:text-muted-foreground"
              >
                Resolver
              </button>
            )}
            {item.dismissedAt === null && (
              <button
                type="button"
                onClick={() => onDismiss(item.id)}
                className="text-xs text-muted-foreground hover:text-muted-foreground"
              >
                Archivar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: Filter }) {
  const messages: Record<Filter, { title: string; body: string }> = {
    all:       { title: "Todo al día",         body: "Las señales útiles van a aparecer acá cuando haya algo concreto para mirar." },
    important: { title: "Nada urgente por ahora", body: "Pagos, presupuestos y deudas importantes se agrupan acá sin ruido extra." },
    positive:  { title: "Sin señales positivas aún", body: "Cuando el mes venga ordenado o baje el gasto, lo vas a ver acá." },
    pending:   { title: "Nada esperando revisión", body: "Las señales pendientes desaparecen cuando las resolvés o dejan de aplicar." },
    archived:  { title: "Archivo vacío",       body: "Las señales archivadas quedan separadas para no ensuciar tu vista diaria." },
  };
  const { title, body } = messages[filter];

  return (
    <PremiumCard>
      <PremiumCardContent className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-4 text-base font-semibold text-muted-foreground">{title}</p>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{body}</p>
      </PremiumCardContent>
    </PremiumCard>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ActivityCenter() {
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  const load = useCallback(async (f: Filter) => {
    await Promise.resolve();
    setStatus("loading");
    try {
      const res = await fetch(`/api/activity?filter=${f}`);
      if (!res.ok) { setStatus("error"); return; }
      const json = (await res.json()) as ApiResponse;
      setItems(json.data?.items ?? []);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(filter), 0);
    return () => window.clearTimeout(id);
  }, [filter, load]);

  async function handleRead(id: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, readAt: new Date().toISOString() } : i));
    try {
      const res = await fetch(`/api/activity/${id}/read`, { method: "POST" });
      if (!res.ok) throw new Error("read failed");
      toast.success("Señal marcada como leída.");
    } catch {
      toast.error("No se pudo actualizar la señal.");
    }
  }

  async function handleDismiss(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      const res = await fetch(`/api/activity/${id}/dismiss`, { method: "POST" });
      if (!res.ok) throw new Error("dismiss failed");
      toast.success("Señal archivada.");
    } catch {
      toast.error("No se pudo archivar la señal.");
    }
  }

  async function handleResolve(id: string) {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, readAt: i.readAt ?? now, resolvedAt: now } : i));
    try {
      const res = await fetch(`/api/activity/${id}/resolve`, { method: "POST" });
      if (!res.ok) throw new Error("resolve failed");
      toast.success("Señal resuelta.");
    } catch {
      toast.error("No se pudo resolver la señal.");
    }
  }

  async function handleMarkAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
    try {
      const res = await fetch("/api/activity/read-all", { method: "POST" });
      if (!res.ok) throw new Error("read all failed");
      toast.success("Actividad marcada como leída.");
    } catch {
      toast.error("No se pudo actualizar la actividad.");
    }
  }

  const pendingCount = items.filter((i) => !i.readAt && !i.resolvedAt && !i.dismissedAt).length;

  return (
    <div data-tutorial="activity-center" className="space-y-5">
      {/* Filter tabs + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition duration-150",
                filter === f.id
                  ? "border-border bg-muted/70 text-foreground"
                  : "border-border bg-muted/20 text-muted-foreground hover:border-border hover:text-muted-foreground",
              )}
            >
              {f.label}
              {f.id === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-teal-400/20 px-1.5 py-0.5 text-[10px] text-teal-300">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Action row */}
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-muted-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Marcar todas leídas
            </button>
          )}
          <button
            type="button"
            onClick={() => void load(filter)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-muted-foreground"
            aria-label="Actualizar"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Feed */}
      {status === "loading" && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="mt-1.5 h-1.5 w-1.5 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-full rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <PremiumCard>
          <PremiumCardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Lightbulb className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted-foreground">No se pudo cargar la actividad.</p>
            <button
              type="button"
              onClick={() => void load(filter)}
              className="mt-3 text-xs text-muted-foreground underline hover:text-muted-foreground"
            >
              Intentar de nuevo
            </button>
          </PremiumCardContent>
        </PremiumCard>
      )}

      {status === "done" && items.length === 0 && <EmptyState filter={filter} />}

      {status === "done" && items.length > 0 && (
        <div className="space-y-2.5">
          {items.map((item) => (
            <ActivityCard
              key={item.id}
              item={item}
              onRead={(id) => void handleRead(id)}
              onResolve={(id) => void handleResolve(id)}
              onDismiss={(id) => void handleDismiss(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
