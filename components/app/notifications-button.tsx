"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BellRing, CheckCircle2, Clock3 } from "lucide-react";
import type { ActivityTone, ActivityType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackProductEvent } from "@/lib/observability/client";

type ActivityPreviewItem = {
  id: string;
  type: ActivityType;
  source: string;
  tone: ActivityTone;
  priority: number;
  title: string;
  body: string;
  readAt: string | null;
  resolvedAt: string | null;
  actionLink: string | null;
};

type ActivitySummary = {
  unreadCount: number;
  pendingCount: number;
};

type ApiResponse = {
  data?: {
    items: ActivityPreviewItem[];
    summary?: ActivitySummary;
  } | null;
};

type NotificationsButtonProps = {
  compact?: boolean;
  className?: string;
  panelClassName?: string;
  embedded?: boolean;
};

const DEFAULT_SUMMARY: ActivitySummary = { unreadCount: 0, pendingCount: 0 };

export function NotificationsButton({
  compact = false,
  className,
  panelClassName,
  embedded = false,
}: NotificationsButtonProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [items, setItems] = useState<ActivityPreviewItem[]>([]);
  const [summary, setSummary] = useState<ActivitySummary>(DEFAULT_SUMMARY);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const receivedRef = useRef(new Set<string>());

  const loadActivity = useCallback(async () => {
    try {
      const response = await fetch("/api/activity?limit=5");
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error("Activity failed");
      const nextItems = payload.data?.items ?? [];
      const nextSummary = payload.data?.summary ?? DEFAULT_SUMMARY;
      setItems(nextItems);
      setSummary(nextSummary);
      setStatus("done");

      const newUnread = nextItems.filter((item) => !item.readAt && !receivedRef.current.has(item.id));
      if (newUnread.length > 0) {
        newUnread.forEach((item) => receivedRef.current.add(item.id));
        trackProductEvent("notification_received", { count: newUnread.length }, "analytics");
      }
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadActivity(), 0);
    const intervalId = window.setInterval(() => void loadActivity(), 120_000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadActivity]);

  useEffect(() => {
    const id = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  const unreadCount = summary.unreadCount;
  const pendingCount = summary.pendingCount;
  const hasPriorityUnread = items.some((item) => !item.readAt && item.priority >= 1);
  const showPanel = embedded || open;

  async function markVisibleRead() {
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setSummary((prev) => ({ ...prev, unreadCount: 0 }));
    await fetch("/api/activity/read-all", { method: "POST" }).catch(() => {});
  }

  function trackOpen(item: ActivityPreviewItem) {
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

  return (
    <div className={embedded ? "w-full" : "relative"}>
      {!embedded ? (
        <Button
          asChild
          variant={compact ? "ghost" : "secondary"}
          size={compact ? "icon" : "sm"}
          className={cn(
            compact &&
              "relative h-9 w-9 rounded-full border-0 bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            !compact && "rounded-full bg-secondary/70 px-3 text-muted-foreground hover:text-foreground",
            className,
          )}
          aria-label={unreadCount > 0 ? `${unreadCount} avisos sin leer` : "Notificaciones"}
          title="Notificaciones"
        >
          <Link href="/notifications" onClick={() => setOpen(false)}>
            {hasPriorityUnread ? (
              <BellRing className="h-4 w-4 text-amber-400" aria-hidden="true" />
            ) : (
              <Bell className="h-4 w-4" aria-hidden="true" />
            )}
            {compact ? null : "Avisos"}
            {unreadCount > 0 ? (
              <span
                className={cn(
                  "rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold leading-none text-black",
                  compact && "absolute -right-0.5 -top-0.5 min-w-4 px-1",
                  !compact && "ml-[-4px]",
                )}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Link>
        </Button>
      ) : null}

      {showPanel ? (
        <div
          className={cn(
            embedded
              ? "w-full overflow-hidden rounded-[var(--v2-radius-lg)] border border-border bg-card shadow-2xl shadow-black/40"
              : "absolute right-0 top-[calc(100%+8px)] z-[70] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-[var(--v2-radius-lg)] border border-border bg-card shadow-2xl shadow-black/60",
            panelClassName,
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Actividad financiera</p>
              <p className="text-xs text-muted-foreground">
                {pendingCount > 0
                  ? `${pendingCount} ${pendingCount === 1 ? "señal pendiente" : "señales pendientes"}`
                  : "Sin señales esperando acción"}
              </p>
            </div>
            {unreadCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 px-2 text-xs"
                onClick={() => void markVisibleRead()}
              >
                Marcar leídas
              </Button>
            ) : null}
          </div>

          <div className={cn("space-y-2 bg-card p-3", !embedded && "max-h-[360px] overflow-y-auto")}>
            {status === "loading" ? (
              <MiniState icon={Clock3} title="Revisando señales" body="Esto tarda un momento." />
            ) : null}

            {status === "error" ? (
              <MiniState icon={Bell} title="No se pudo cargar" body="Tus señales siguen disponibles en el centro." />
            ) : null}

            {status === "done" && items.length === 0 ? (
              <MiniState
                icon={CheckCircle2}
                title="Todo tranquilo"
                body="Meridian te avisa solo cuando hay algo concreto para mirar."
              />
            ) : null}

            {status === "done" && items.length > 0
              ? items.map((item) => (
                  <Link
                    key={item.id}
                    href={item.actionLink ?? "/notifications"}
                    onClick={() => trackOpen(item)}
                    className={cn(
                      "block rounded-2xl border p-3 transition hover:bg-muted/40",
                      item.readAt && "opacity-60",
                      item.tone === "positive" && "border-teal-300/20 bg-teal-300/10",
                      item.tone === "warning" && "border-amber-300/20 bg-amber-300/10",
                      item.tone === "neutral" && "border-border bg-muted/20",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                          item.tone === "positive" && "bg-teal-400",
                          item.tone === "warning" && "bg-amber-400",
                          item.tone === "neutral" && "bg-zinc-500",
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>
                        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">{item.body}</span>
                      </span>
                    </div>
                  </Link>
                ))
              : null}
          </div>

          <div className="border-t border-border bg-card p-3">
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/notifications">Ver centro de actividad</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MiniState({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Bell;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted p-5 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-teal-400/10 text-teal-300">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}
