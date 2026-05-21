"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Archive,
  Bell,
  BrainCircuit,
  CheckCheck,
  CheckCircle2,
  Clock,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PremiumCard, PremiumCardContent } from "@/components/ui-v2/premium-card";
import { trackProductEvent } from "@/lib/observability/client";
import type { ActivityType, ActivityTone } from "@prisma/client";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ───────────────────────────────────────────────────────────────────

type ActivityItem = {
  id: string;
  type: ActivityType;
  source: string;
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
  data?: {
    items: ActivityItem[];
    summary?: {
      unreadCount: number;
      pendingCount: number;
    };
  } | null;
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

const SOURCE_LABEL: Partial<Record<string, string>> = {
  "weekly-pulse":       "Pulso semanal",
  "weekly-reflection":  "Pulso semanal",
  "monthly-close":      "Cierre mensual",
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
    bg:     "bg-teal-300/10",
    text:   "text-teal-300",
    label:  "text-teal-400",
  },
  neutral: {
    dot:    "bg-zinc-500",
    border: "border-border",
    bg:     "bg-muted/40",
    text:   "text-muted-foreground",
    label:  "text-muted-foreground",
  },
  warning: {
    dot:    "bg-amber-400",
    border: "border-amber-300/20",
    bg:     "bg-amber-300/10",
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

// ── SwipeCard ────────────────────────────────────────────────────────────────
// Reveal-then-tap model: swipe reveals action buttons, tap executes.
// No auto-execute on swipe — the user always confirms with an explicit tap.

function SwipeCard({
  onArchive,
  onDelete,
  onResolve,
  onPostpone,
  resolveLabel = "Revisar",
  children,
}: {
  onArchive: () => void;
  onDelete: () => void;
  onResolve: () => void;
  onPostpone: () => void;
  resolveLabel?: string;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [phase, setPhase] = useState<"idle" | "dragging" | "revealed" | "executing">("idle");

  // All mutable state in refs to avoid stale closures in native event handlers
  const offsetRef = useRef(0);
  const phaseRef = useRef<"idle" | "dragging" | "revealed" | "executing">("idle");
  const gRef = useRef({
    active: false, startX: 0, startY: 0,
    axis: null as "x" | "y" | null, baseOffset: 0, raf: 0,
  });
  const actionsRef = useRef({ onArchive, onDelete, onResolve, onPostpone });
  actionsRef.current = { onArchive, onDelete, onResolve, onPostpone };

  // Fixed button width — independent of card width, comfortable tap target
  const ACTION_W = 72;
  const SNAP_ONE = ACTION_W;
  const SNAP_TWO = ACTION_W * 2;
  const DEAD_ZONE   = 0.08; // < 8%  → always snap back
  const TWO_RATIO   = 0.36; // > 36% → snap to two actions
  const RESIST_FROM = 0.36; // rubber band starts here
  const MAX_DRAG    = 0.75;

  function sync(x: number, p: typeof phase) {
    offsetRef.current = x; setOffset(x);
    phaseRef.current = p;  setPhase(p);
  }

  function getSnap(x: number, w: number): number {
    const r = Math.abs(x) / w;
    const s = x < 0 ? -1 : 1;
    if (r < DEAD_ZONE) return 0;
    if (r < TWO_RATIO) return s * SNAP_ONE;
    return s * SNAP_TWO;
  }

  function executeAction(key: "onArchive" | "onDelete" | "onResolve" | "onPostpone") {
    if (phaseRef.current === "executing") return;
    phaseRef.current = "executing"; setPhase("executing");
    if ("vibrate" in navigator) navigator.vibrate(key === "onDelete" ? [8, 4, 8] : [8]);
    const w = containerRef.current?.offsetWidth ?? 320;
    const flyX = (offsetRef.current <= 0 ? -1 : 1) * w * 1.1;
    offsetRef.current = flyX; setOffset(flyX);
    setTimeout(() => {
      sync(0, "idle");
      actionsRef.current[key]();
    }, 210);
  }

  function snapBack() {
    sync(0, "idle");
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const g = gRef.current;

    function onTouchStart(e: TouchEvent) {
      if (phaseRef.current === "executing") return;
      g.active = true; g.axis = null;
      g.startX = e.touches[0].clientX;
      g.startY = e.touches[0].clientY;
      g.baseOffset = offsetRef.current;
    }

    function onTouchMove(e: TouchEvent) {
      if (!g.active || phaseRef.current === "executing") return;
      const dx = e.touches[0].clientX - g.startX;
      const dy = e.touches[0].clientY - g.startY;
      if (!g.axis) {
        if (Math.abs(dx) + Math.abs(dy) < 6) return;
        g.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        if (g.axis === "y") { g.active = false; return; }
      }
      e.preventDefault();
      if (phaseRef.current !== "dragging") { phaseRef.current = "dragging"; setPhase("dragging"); }

      const w = el!.offsetWidth;
      const raw = g.baseOffset + dx;
      const CAP = w * MAX_DRAG;
      const RT  = w * RESIST_FROM;
      let clamped = Math.max(-CAP, Math.min(CAP, raw));
      if (Math.abs(clamped) > RT) {
        const s = clamped < 0 ? -1 : 1;
        clamped = s * (RT + (Math.abs(clamped) - RT) * 0.15);
      }
      cancelAnimationFrame(g.raf);
      g.raf = requestAnimationFrame(() => { offsetRef.current = clamped; setOffset(clamped); });
    }

    function onTouchEnd() {
      if (!g.active) return;
      g.active = false;
      if (phaseRef.current === "executing") return;
      const snap = getSnap(offsetRef.current, el!.offsetWidth);
      offsetRef.current = snap; setOffset(snap);
      if (snap === 0) {
        phaseRef.current = "idle"; setPhase("idle");
      } else {
        phaseRef.current = "revealed"; setPhase("revealed");
        if ("vibrate" in navigator) navigator.vibrate([4]);
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove",  onTouchMove,  { passive: false });
    el.addEventListener("touchend",   onTouchEnd,   { passive: true });
    el.addEventListener("touchcancel",onTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
      el.removeEventListener("touchend",   onTouchEnd);
      el.removeEventListener("touchcancel",onTouchEnd);
      cancelAnimationFrame(g.raf);
    };
  }, []);

  // Derived visual state
  const leftW  = Math.max(0, offset);   // right swipe → left strip (Resolve/Postpone)
  const rightW = Math.max(0, -offset);  // left swipe  → right strip (Archive/Delete)
  // Icon scale: 0.84 → 1.0 as strip fills to first button width
  const lScale = Math.min(0.84 + (leftW  / SNAP_ONE) * 0.16, 1.0);
  const rScale = Math.min(0.84 + (rightW / SNAP_ONE) * 0.16, 1.0);
  const cardTransition =
    phase === "dragging"   ? "none" :
    phase === "executing"  ? "transform 0.20s cubic-bezier(0.25,0.46,0.45,0.94)" :
                             "transform 0.32s cubic-bezier(0.34,1.56,0.64,1)";

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-2xl">

      {/* LEFT strip — swipe right reveals: Resolve (outer) · Postpone (inner) */}
      {leftW > 0 && (
        <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: leftW }}>
          {/* Resolve — always at far-left edge, visible from first pixel */}
          <button
            type="button"
            className="absolute inset-y-0 left-0 flex w-[72px] flex-col items-center justify-center gap-1 bg-teal-500/[0.13] transition active:bg-teal-500/[0.22]"
            onClick={(e) => { e.stopPropagation(); executeAction("onResolve"); }}
            aria-label={resolveLabel}
          >
            <CheckCircle2 className="h-5 w-5 text-teal-400" style={{ transform: `scale(${lScale})` }} />
            <span className="text-[10px] font-semibold text-teal-400">{resolveLabel}</span>
          </button>
          {/* Postpone — clipped by overflow until strip ≥ 144px */}
          <button
            type="button"
            className="absolute inset-y-0 left-[72px] flex w-[72px] flex-col items-center justify-center gap-1 bg-amber-500/[0.10] transition active:bg-amber-500/[0.18]"
            onClick={(e) => { e.stopPropagation(); executeAction("onPostpone"); }}
            aria-label="Más tarde"
          >
            <Clock className="h-5 w-5 text-amber-400" style={{ transform: `scale(${lScale})` }} />
            <span className="text-[10px] font-semibold text-amber-400">Más tarde</span>
          </button>
        </div>
      )}

      {/* RIGHT strip — swipe left reveals: Archive (outer) · Delete (inner) */}
      {rightW > 0 && (
        <div className="absolute inset-y-0 right-0 overflow-hidden" style={{ width: rightW }}>
          {/* Archive — at far-right edge, visible from first pixel */}
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-[72px] flex-col items-center justify-center gap-1 bg-slate-500/[0.16] transition active:bg-slate-500/[0.26]"
            onClick={(e) => { e.stopPropagation(); executeAction("onArchive"); }}
            aria-label="Archivar"
          >
            <Archive className="h-5 w-5 text-slate-400" style={{ transform: `scale(${rScale})` }} />
            <span className="text-[10px] font-semibold text-slate-400">Archivar</span>
          </button>
          {/* Delete — clipped by overflow until strip ≥ 144px */}
          <button
            type="button"
            className="absolute inset-y-0 right-[72px] flex w-[72px] flex-col items-center justify-center gap-1 bg-rose-500/[0.11] transition active:bg-rose-500/[0.18]"
            onClick={(e) => { e.stopPropagation(); executeAction("onDelete"); }}
            aria-label="Eliminar"
          >
            <Trash2 className="h-5 w-5 text-rose-400" style={{ transform: `scale(${rScale})` }} />
            <span className="text-[10px] font-semibold text-rose-400">Eliminar</span>
          </button>
        </div>
      )}

      {/* Draggable card content — tap when revealed snaps back without executing */}
      <div
        style={{ transform: `translateX(${offset}px)`, transition: cardTransition, willChange: "transform" }}
        onClick={() => { if (phase === "revealed") snapBack(); }}
      >
        {children}
      </div>
    </div>
  );
}

// ── ActivityCard ─────────────────────────────────────────────────────────────

function ActivityCard({
  item,
  onRead,
  onOpen,
  onResolve,
  onDismiss,
}: {
  item: ActivityItem;
  onRead: (id: string) => void;
  onOpen: (item: ActivityItem) => void;
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
        "group relative rounded-2xl border px-4 py-3.5 transition-opacity duration-200",
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
              {SOURCE_LABEL[item.source] ?? TYPE_LABEL[item.type]}
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
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            {item.actionLabel && item.actionLink && (
              <Link
                href={item.actionLink}
                onClick={() => onOpen(item)}
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
  const [summary, setSummary] = useState({ unreadCount: 0, pendingCount: 0 });
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const markedReadSignature = useRef<string | null>(null);

  const load = useCallback(async (f: Filter) => {
    await Promise.resolve();
    setStatus("loading");
    try {
      const res = await fetch(`/api/activity?filter=${f}`);
      if (!res.ok) { setStatus("error"); return; }
      const json = (await res.json()) as ApiResponse;
      setItems(json.data?.items ?? []);
      setSummary(json.data?.summary ?? { unreadCount: 0, pendingCount: 0 });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(filter), 0);
    return () => window.clearTimeout(id);
  }, [filter, load]);

  const unreadVisibleIds = useMemo(
    () => items.filter((item) => !item.readAt && !item.dismissedAt).map((item) => item.id),
    [items],
  );

  useEffect(() => {
    if (status !== "done" || unreadVisibleIds.length === 0) return;

    const signature = unreadVisibleIds.join(",");
    if (markedReadSignature.current === signature) return;
    markedReadSignature.current = signature;

    const timeout = window.setTimeout(() => {
      const readAt = new Date().toISOString();
      setItems((prev) => prev.map((item) => unreadVisibleIds.includes(item.id) ? { ...item, readAt } : item));
      setSummary((prev) => ({ ...prev, unreadCount: 0 }));
      trackProductEvent("notification_received", { count: unreadVisibleIds.length }, "analytics");
      void fetch("/api/activity/read-all", { method: "POST" }).catch(() => {});
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [status, unreadVisibleIds]);

  async function handleRead(id: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, readAt: new Date().toISOString() } : i));
    setSummary((prev) => ({ ...prev, unreadCount: Math.max(prev.unreadCount - 1, 0) }));
    try {
      const res = await fetch(`/api/activity/${id}/read`, { method: "POST" });
      if (!res.ok) throw new Error("read failed");
      toast.success("Señal marcada como leída.");
    } catch {
      toast.error("No se pudo actualizar la señal.");
    }
  }

  async function handleDismiss(id: string) {
    const item = items.find((i) => i.id === id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSummary((prev) => ({
      unreadCount: item && !item.readAt ? Math.max(prev.unreadCount - 1, 0) : prev.unreadCount,
      pendingCount: item && !item.resolvedAt ? Math.max(prev.pendingCount - 1, 0) : prev.pendingCount,
    }));
    if (item) {
      trackProductEvent(
        "notification_dismissed",
        { type: item.type, tone: item.tone, priority: item.priority },
        "analytics",
      );
    }
    try {
      const res = await fetch(`/api/activity/${id}/dismiss`, { method: "POST" });
      if (!res.ok) throw new Error("dismiss failed");
      toast.success("Señal archivada.");
    } catch {
      toast.error("No se pudo archivar la señal.");
    }
  }

  async function handleResolve(id: string) {
    const item = items.find((i) => i.id === id);
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, readAt: i.readAt ?? now, resolvedAt: now } : i));
    setSummary((prev) => ({
      unreadCount: item && !item.readAt ? Math.max(prev.unreadCount - 1, 0) : prev.unreadCount,
      pendingCount: item && !item.resolvedAt ? Math.max(prev.pendingCount - 1, 0) : prev.pendingCount,
    }));
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
    setSummary((prev) => ({ ...prev, unreadCount: 0 }));
    try {
      const res = await fetch("/api/activity/read-all", { method: "POST" });
      if (!res.ok) throw new Error("read all failed");
      toast.success("Actividad marcada como leída.");
    } catch {
      toast.error("No se pudo actualizar la actividad.");
    }
  }

  function handleOpen(item: ActivityItem) {
    trackProductEvent(
      "notification_opened",
      { type: item.type, tone: item.tone, priority: item.priority },
      "analytics",
    );
    if (item.source === "weekly-pulse") {
      trackProductEvent("pulse_notification_opened", { tone: item.tone }, "dashboard");
    }
    if (item.source === "monthly-close") {
      trackProductEvent("monthly_close_notification_opened", { tone: item.tone }, "dashboard");
    }
  }

  const pendingCount = summary.pendingCount;

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
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-muted/20 px-4 py-3.5">
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
        <div className="space-y-2">
          {items.map((item) => (
            <SwipeCard
              key={item.id}
              onArchive={() => void handleDismiss(item.id)}
              onDelete={() => void handleDismiss(item.id)}
              onResolve={() => void handleResolve(item.id)}
              onPostpone={() => void handleRead(item.id)}
              resolveLabel={item.actionLabel ?? "Revisar"}
            >
              <ActivityCard
                item={item}
                onRead={(id) => void handleRead(id)}
                onOpen={handleOpen}
                onResolve={(id) => void handleResolve(id)}
                onDismiss={(id) => void handleDismiss(id)}
              />
            </SwipeCard>
          ))}
        </div>
      )}
    </div>
  );
}
