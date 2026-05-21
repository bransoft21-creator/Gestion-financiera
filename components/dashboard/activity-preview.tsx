"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PremiumCard,
  PremiumCardContent,
} from "@/components/ui-v2/premium-card";
import { cn } from "@/lib/utils";
import type { ActivityPreviewItem } from "@/app/(private)/dashboard/types";

export function ActivityPreview() {
  const [items, setItems] = useState<ActivityPreviewItem[]>([]);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/activity?preview=1&limit=3");
        const payload = (await response.json()) as { data?: { items: ActivityPreviewItem[] } };
        if (!response.ok) throw new Error("Activity preview failed");
        if (!cancelled) {
          setItems(payload.data?.items ?? []);
          setStatus("done");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (status === "error" || status === "loading") return null;
  if (items.length === 0) return null;

  const pendingCount = items.filter((item) => !item.readAt && !item.resolvedAt).length;
  if (pendingCount === 0) return null;

  return (
    <PremiumCard className="mb-5">
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4 sm:px-6 sm:pt-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Señales pendientes
          </p>
          <h3 className="mt-1 text-sm font-semibold text-foreground">
            {`${pendingCount} ${pendingCount === 1 ? "señal" : "señales"} para revisar`}
          </h3>
        </div>
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="h-8 shrink-0 px-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        >
          <Link href="/notifications">Ver todas →</Link>
        </Button>
      </div>

      <PremiumCardContent className="pt-1">
        <div className="space-y-1.5">
          {items.filter((item) => !item.readAt && !item.resolvedAt).slice(0, 3).map((item) => (
            <Link
              key={item.id}
              href={item.actionLink ?? "/notifications"}
              className="group flex items-start gap-2.5 rounded-xl border border-border bg-muted/20 px-3 py-2.5 transition hover:border-border hover:bg-muted/40"
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
                  item.tone === "positive" && "bg-teal-400/10 text-teal-300",
                  item.tone === "warning" && "bg-amber-400/10 text-amber-300",
                  item.tone === "neutral" && "bg-muted/50 text-muted-foreground",
                )}
              >
                <Bell className="h-3 w-3" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-muted-foreground group-hover:text-foreground">
                  {item.title}
                </span>
                <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">{item.body}</span>
              </span>
            </Link>
          ))}
        </div>
      </PremiumCardContent>
    </PremiumCard>
  );
}
