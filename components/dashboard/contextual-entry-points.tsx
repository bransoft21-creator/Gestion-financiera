import Link from "next/link";
import {
  BarChart3,
  Bell,
  CreditCard,
  HandCoins,
  Home,
  ListChecks,
  RefreshCw,
  ScanLine,
  type LucideIcon,
} from "lucide-react";
import { PremiumCard, PremiumCardContent, PremiumCardHeader, PremiumCardTitle } from "@/components/ui-v2/premium-card";
import { cn } from "@/lib/utils";
import type { AwarenessTarget, ContextualEntryPoint } from "@/lib/navigation-awareness";

const entryIcons: Record<AwarenessTarget, LucideIcon> = {
  "smart-import": ScanLine,
  budgets: BarChart3,
  recurring: RefreshCw,
  debts: CreditCard,
  household: Home,
  activity: Bell,
  "data-quality": ListChecks,
  agreements: HandCoins,
};

export function ContextualEntryPoints({ entryPoints }: { entryPoints: ContextualEntryPoint[] }) {
  if (entryPoints.length === 0) return null;

  return (
    <PremiumCard variant="quiet" className="mb-5 sm:mb-8">
      <PremiumCardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <PremiumCardTitle className="text-sm">En foco</PremiumCardTitle>
          <span className="text-[11px] font-medium text-muted-foreground">Señales suaves</span>
        </div>
      </PremiumCardHeader>
      <PremiumCardContent className="pt-0">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {entryPoints.map((entry) => {
            const Icon = entryIcons[entry.id];
            return (
              <Link
                key={`${entry.id}-${entry.href}`}
                href={entry.href}
                className="group flex min-w-0 gap-3 rounded-[var(--v2-radius-lg)] border border-border bg-background/40 p-3 transition hover:bg-muted/45"
              >
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                    entry.tone === "attention"
                      ? "border-amber-300/20 bg-amber-300/10 text-amber-500"
                      : "border-border bg-muted/35 text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{entry.title}</p>
                    <span className="shrink-0 rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {entry.label}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{entry.body}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </PremiumCardContent>
    </PremiumCard>
  );
}
