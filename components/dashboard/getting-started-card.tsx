"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CircleDollarSign,
  CreditCard,
  Home,
  Landmark,
  ReceiptText,
  RefreshCw,
  ScanLine,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { ActionButton } from "@/components/ui-v2/action-button";
import {
  PremiumCard,
  PremiumCardContent,
  PremiumCardDescription,
  PremiumCardHeader,
  PremiumCardTitle,
} from "@/components/ui-v2/premium-card";
import { cn } from "@/lib/utils";
import { trackProductEvent } from "@/lib/observability/client";
import type { ActivationAction, NextStepRecommendation } from "@/app/(private)/dashboard/types";

const DISMISS_KEY = "meridian-getting-started-card-dismissed-v1";

const actionIcons: Record<ActivationAction["id"], LucideIcon> = {
  "create-account": Landmark,
  "first-income": CircleDollarSign,
  "smart-import": ScanLine,
  "setup-household": Home,
  "shared-expense": ReceiptText,
  "invite-household": Home,
  "setup-budgets": BarChart3,
  "organize-debts": CreditCard,
  "review-movements": ReceiptText,
  "setup-recurring": RefreshCw,
};

export function GettingStartedCard({ activation }: { activation: NextStepRecommendation }) {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(DISMISS_KEY) === "1",
  );

  if (!activation.shouldShow || dismissed || activation.actions.length === 0) return null;

  const [primaryAction, ...secondaryActions] = activation.actions;
  const PrimaryIcon = actionIcons[primaryAction.id] ?? Sparkles;

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
    trackProductEvent("getting_started_card_dismissed", { actionCount: activation.actions.length }, "dashboard");
  }

  function trackAction(action: ActivationAction, index: number) {
    trackProductEvent(
      "getting_started_action_clicked",
      { actionId: action.id, actionIndex: index, isOnboardingFresh: activation.isOnboardingFresh },
      "dashboard",
    );
  }

  return (
    <PremiumCard variant="raised" className="mb-8 overflow-hidden border-border/80 bg-background/95 sm:mb-10">
      <PremiumCardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Siguiente paso
            </p>
            <PremiumCardTitle className="text-xl">{activation.headline}</PremiumCardTitle>
            <PremiumCardDescription className="mt-2 max-w-2xl">{activation.body}</PremiumCardDescription>
          </div>
          <button
            type="button"
            onClick={dismiss}
            title="Ocultar"
            aria-label="Ocultar siguiente paso"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </PremiumCardHeader>

      <PremiumCardContent className="pt-0">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
          <Link
            href={primaryAction.href}
            onClick={() => trackAction(primaryAction, 0)}
            className="group block min-w-0 rounded-[var(--v2-radius-lg)] border border-border bg-muted/30 p-4 transition hover:bg-muted/50"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background/80 text-primary">
                <PrimaryIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{primaryAction.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{primaryAction.description}</p>
                <p className="mt-3 text-[11px] font-medium text-muted-foreground">{primaryAction.reason}</p>
              </div>
            </div>
            <ActionButton asChild size="sm" className="mt-4 w-full sm:w-auto">
              <span>Empezar</span>
            </ActionButton>
          </Link>

          <div className="grid min-w-0 gap-2">
            {secondaryActions.map((action, index) => {
              const Icon = actionIcons[action.id] ?? Sparkles;
              return (
                <Link
                  key={action.id}
                  href={action.href}
                  onClick={() => trackAction(action, index + 1)}
                  className={cn(
                    "flex min-w-0 items-center gap-3 rounded-[var(--v2-radius-lg)] border border-border bg-muted/20 px-4 py-3 transition hover:bg-muted/45",
                    secondaryActions.length === 1 && "lg:min-h-full",
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background/70 text-muted-foreground">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{action.title}</p>
                    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{action.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </PremiumCardContent>
    </PremiumCard>
  );
}
