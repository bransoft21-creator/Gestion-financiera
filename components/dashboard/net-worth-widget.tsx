"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { Skeleton } from "@/components/ui/skeleton";

type NetWorthEntry = {
  currency: string;
  assets: number;
  liabilities: number;
  netWorth: number;
};

function formatMoney(value: number, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function NetWorthWidget({ householdId }: { householdId: string }) {
  const [data, setData] = useState<NetWorthEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ householdId, includeArchived: "false" });
    fetch(`/api/accounts?${params}`)
      .then((r) => r.json())
      .then((json: { data?: { netWorthByCurrency: NetWorthEntry[] } }) => {
        if (!cancelled) setData(json.data?.netWorthByCurrency ?? []);
      })
      .catch(() => {
        if (!cancelled) setData([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [householdId]);

  if (isLoading) {
    return (
      <div className="mb-4">
        <Skeleton className="h-14 rounded-2xl" />
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  const primary = data[0];
  if (!primary) return null;
  const hasSecondCurrency = data.length > 1;
  const isPositive = primary.netWorth >= 0;

  return (
    <Link
      href="/accounts"
      className="mb-4 block rounded-2xl border border-border bg-muted/20 transition hover:bg-muted/40"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60">
          <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Patrimonio neto
          </p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            {data.map((entry) => (
              <span
                key={entry.currency}
                className={
                  entry.netWorth >= 0
                    ? "text-[15px] font-semibold tabular-nums text-foreground"
                    : "text-[15px] font-semibold tabular-nums text-rose-400"
                }
              >
                <SensitiveAmount value={formatMoney(entry.netWorth, entry.currency)} />
              </span>
            ))}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[11px] tabular-nums text-emerald-500">
              <SensitiveAmount value={`+${formatMoney(primary.assets, primary.currency)}`} />
            </span>
            {primary.liabilities > 0 && (
              <span className="text-[11px] tabular-nums text-rose-400">
                <SensitiveAmount value={`−${formatMoney(primary.liabilities, primary.currency)}`} />
              </span>
            )}
            {hasSecondCurrency && (
              <span className="text-[10px] text-muted-foreground/50">+{data.length - 1} moneda más</span>
            )}
          </div>
        </div>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" aria-hidden="true" />
      </div>
      {!isPositive && (
        <div className="border-t border-border/50 px-4 py-1.5">
          <p className="text-[11px] text-muted-foreground/60">
            Los pasivos superan los activos registrados.
          </p>
        </div>
      )}
    </Link>
  );
}
