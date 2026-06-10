"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { Skeleton } from "@/components/ui/skeleton";

type GoalItem = {
  id: string;
  name: string;
  currency: string;
  targetAmount: number;
  currentAmount: number;
  requiredMonthlyAmount: number | null;
  targetDate: string | null;
  status: string;
};

function formatMoney(value: number, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function GoalsWidget({ householdId }: { householdId: string }) {
  const [goals, setGoals] = useState<GoalItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/goals?householdId=${encodeURIComponent(householdId)}&status=ACTIVE`)
      .then((r) => r.json())
      .then((json: { data?: GoalItem[] }) => {
        if (!cancelled) setGoals(json.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setGoals([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [householdId]);

  const activeGoals = goals?.filter((g) => g.status === "ACTIVE") ?? [];
  const totalMonthly = activeGoals.reduce((s, g) => s + (g.requiredMonthlyAmount ?? 0), 0);

  // Only show if there are active goals with monthly allocations
  if (!isLoading && (activeGoals.length === 0 || totalMonthly === 0)) return null;

  if (isLoading) {
    return (
      <div className="mb-4">
        <Skeleton className="h-16 rounded-2xl" />
      </div>
    );
  }

  const visibleGoals = activeGoals.slice(0, 3);

  return (
    <Link
      href="/goals"
      className="mb-4 block rounded-2xl border border-violet-500/15 bg-violet-500/[0.04] transition hover:bg-violet-500/[0.07]"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
          <Target className="h-4 w-4 text-violet-400" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-[13px] font-semibold text-foreground">
              Metas activas
            </p>
            <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
              {activeGoals.length} meta{activeGoals.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {visibleGoals.map((g) => {
              const progress = g.targetAmount > 0 ? Math.min((g.currentAmount / g.targetAmount) * 100, 100) : 0;
              return (
                <GoalMiniBar key={g.id} name={g.name} progress={progress} />
              );
            })}
            {activeGoals.length > 3 && (
              <span className="text-[11px] text-muted-foreground/60">+{activeGoals.length - 3} más</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[12px] font-semibold tabular-nums text-violet-400">
            <SensitiveAmount value={formatMoney(totalMonthly)} />
          </p>
          <p className="text-[10px] text-muted-foreground/60">por mes</p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" aria-hidden="true" />
      </div>
    </Link>
  );
}

function GoalMiniBar({ name, progress }: { name: string; progress: number }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div className="h-1 w-14 overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            progress >= 80 ? "bg-emerald-400" : progress >= 40 ? "bg-violet-400" : "bg-violet-400/50",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="truncate text-[10px] text-muted-foreground/70">{name}</span>
    </div>
  );
}
