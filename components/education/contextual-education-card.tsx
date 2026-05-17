"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Bookmark, Check, ChevronDown, Lightbulb, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackProductEvent } from "@/lib/observability/client";
import type { EducationItem, EducationSurface } from "@/lib/finance/contextual-education";

type StoredState = Record<string, number>;

const DISMISSED_KEY = "meridian-education-dismissed-v1";
const SAVED_KEY = "meridian-education-saved-v1";

const TONE_STYLES: Record<EducationItem["tone"], { border: string; icon: string; dot: string }> = {
  positive: {
    border: "border-teal-500/20 bg-teal-500/[0.035]",
    icon: "text-teal-400",
    dot: "bg-teal-400",
  },
  neutral: {
    border: "border-border bg-muted/20",
    icon: "text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
  warning: {
    border: "border-amber-500/20 bg-amber-500/[0.04]",
    icon: "text-amber-400",
    dot: "bg-amber-400",
  },
};

function readStoredJson(key: string): string {
  if (typeof window === "undefined") return "{}";
  return window.localStorage.getItem(key) ?? "{}";
}

function parseStoredState(value: string): StoredState {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([, value]) => typeof value === "number"),
    ) as StoredState;
  } catch {
    return {};
  }
}

function writeStoredState(key: string, value: StoredState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("meridian-education-storage"));
}

function subscribeToEducationStorage(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("meridian-education-storage", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("meridian-education-storage", onStoreChange);
  };
}

function useStoredState(key: string) {
  const snapshot = useSyncExternalStore(
    subscribeToEducationStorage,
    () => readStoredJson(key),
    () => "{}",
  );
  return useMemo(() => parseStoredState(snapshot), [snapshot]);
}

function subscribeToMinute(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const interval = window.setInterval(onStoreChange, 60_000);
  return () => window.clearInterval(interval);
}

function useCurrentMinute() {
  return useSyncExternalStore(
    subscribeToMinute,
    () => Math.floor(new Date().getTime() / 60_000),
    () => 0,
  );
}

function getActiveDismissedState(item: EducationItem, dismissed: StoredState, currentMinute: number) {
  const expiryAt = dismissed[item.id];
  if (!expiryAt) return false;
  return expiryAt > currentMinute * 60_000;
}

type ContextualEducationCardProps = {
  item: EducationItem | null;
  surface: EducationSurface;
  compact?: boolean;
  className?: string;
};

export function ContextualEducationCard({
  item,
  surface,
  compact = false,
  className,
}: ContextualEducationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const dismissed = useStoredState(DISMISSED_KEY);
  const saved = useStoredState(SAVED_KEY);
  const currentMinute = useCurrentMinute();
  const isHidden = item ? getActiveDismissedState(item, dismissed, currentMinute) : true;

  useEffect(() => {
    if (!item || isHidden) return;
    trackProductEvent(
      "education_viewed",
      { educationId: item.id, surface, category: item.category, tone: item.tone },
      "dashboard",
    );
  }, [isHidden, item, surface]);

  if (!item || isHidden) return null;

  const tone = TONE_STYLES[item.tone];
  const isSaved = Boolean(saved[item.id]);

  function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && item) {
      trackProductEvent(
        "education_expanded",
        { educationId: item.id, surface, category: item.category, tone: item.tone },
        "dashboard",
      );
      trackProductEvent(
        "education_action_clicked",
        { educationId: item.id, surface, category: item.category, tone: item.tone, actionId: "expand" },
        "dashboard",
      );
    }
  }

  function handleSave() {
    if (!item) return;
    const next = { ...saved };
    if (next[item.id]) {
      delete next[item.id];
    } else {
      next[item.id] = new Date().getTime();
      trackProductEvent(
        "education_saved",
        { educationId: item.id, surface, category: item.category, tone: item.tone },
        "dashboard",
      );
      trackProductEvent(
        "education_action_clicked",
        { educationId: item.id, surface, category: item.category, tone: item.tone, actionId: "save" },
        "dashboard",
      );
    }
    writeStoredState(SAVED_KEY, next);
  }

  function handleDismiss() {
    if (!item) return;
    const expiryMs = item.expiresInDays * 24 * 60 * 60 * 1000;
    const next = { ...dismissed, [item.id]: new Date().getTime() + expiryMs };
    writeStoredState(DISMISSED_KEY, next);
    trackProductEvent(
      "education_dismissed",
      { educationId: item.id, surface, category: item.category, tone: item.tone },
      "dashboard",
    );
  }

  return (
    <section
      className={cn(
        "rounded-lg border p-4 text-foreground",
        tone.border,
        compact ? "space-y-3" : "space-y-4 sm:p-5",
        className,
      )}
      aria-label={`Contexto financiero: ${item.title}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background/40", tone.icon)}
          aria-hidden="true"
        >
          <Lightbulb className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} aria-hidden="true" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Contexto útil
            </p>
          </div>
          <h3 className={cn("mt-1 font-semibold leading-tight text-foreground", compact ? "text-sm" : "text-base")}>
            {item.title}
          </h3>
          <p className={cn("mt-1.5 leading-6 text-muted-foreground", compact ? "text-sm" : "text-[15px]")}>
            {item.body}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-transparent text-muted-foreground transition hover:border-border hover:bg-muted/40"
          aria-label="Ocultar aprendizaje"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {expanded && (
        <div className="rounded-md border border-border bg-background/35 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
          {item.takeaway}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleExpand}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-0 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          aria-expanded={expanded}
        >
          {expanded ? "Menos contexto" : "Entender esto"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
          aria-label={isSaved ? "Aprendizaje guardado" : "Guardar aprendizaje"}
        >
          {isSaved ? (
            <Check className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" />
          ) : (
            <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {isSaved ? "Guardado" : "Guardar"}
        </button>
      </div>
    </section>
  );
}
