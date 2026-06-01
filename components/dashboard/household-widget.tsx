"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { PremiumCard, PremiumCardContent } from "@/components/ui-v2/premium-card";

type HouseholdSnap = {
  id: string;
  name: string;
  pendingCount: number;
  overdueCount: number;
  settlementAmount: number | null;
  settlementFrom: string | null;
  settlementTo: string | null;
  currency: string;
};

function formatArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function HouseholdWidget() {
  const [snap, setSnap] = useState<HouseholdSnap | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Get first collaborative household
        const hRes = await fetch("/api/households");
        const hPayload = (await hRes.json()) as { data?: Array<{ id: string; name: string }> };
        const household = hPayload.data?.[0];
        if (!household || cancelled) return;

        // Fetch recurring payments and balance in parallel
        const monthKey = new Intl.DateTimeFormat("es-AR", {
          year: "numeric",
          month: "2-digit",
          timeZone: "America/Argentina/Buenos_Aires",
        })
          .format(new Date())
          .split("/")
          .reverse()
          .join("-");

        const [rpRes, balRes] = await Promise.all([
          fetch(`/api/households/recurring-payments?householdId=${household.id}&monthKey=${monthKey}`),
          fetch(`/api/households/balance?householdId=${household.id}`),
        ]);

        const rpPayload = (await rpRes.json()) as {
          data?: { pendingCount: number; overdueCount: number };
        };
        const balPayload = (await balRes.json()) as {
          data?: {
            settlement: { fromName: string; toName: string; amount: number } | null;
          };
        };

        if (cancelled) return;

        setSnap({
          id: household.id,
          name: household.name,
          pendingCount: rpPayload.data?.pendingCount ?? 0,
          overdueCount: rpPayload.data?.overdueCount ?? 0,
          settlementAmount: balPayload.data?.settlement?.amount ?? null,
          settlementFrom: balPayload.data?.settlement?.fromName ?? null,
          settlementTo: balPayload.data?.settlement?.toName ?? null,
          currency: "ARS",
        });
      } catch {
        // silent — widget is non-critical
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!snap) return null;

  const hasIssues = snap.overdueCount > 0 || snap.settlementAmount !== null;
  const pendingLabel =
    snap.overdueCount > 0
      ? `${snap.overdueCount} pago${snap.overdueCount > 1 ? "s" : ""} vencido${snap.overdueCount > 1 ? "s" : ""}`
      : snap.pendingCount > 0
        ? `${snap.pendingCount} pago${snap.pendingCount > 1 ? "s" : ""} pendiente${snap.pendingCount > 1 ? "s" : ""}`
        : "Pagos al día";

  return (
    <Link href="/household" className="block mb-4">
      <PremiumCard interactive className="overflow-hidden">
        <PremiumCardContent className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${hasIssues ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
              <Home className={`h-4 w-4 ${hasIssues ? "text-amber-500" : "text-emerald-500"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {snap.name}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className={`font-medium ${snap.overdueCount > 0 ? "text-amber-500" : snap.pendingCount > 0 ? "text-foreground" : "text-emerald-500"}`}>
                  {pendingLabel}
                </span>
                {snap.settlementAmount !== null && snap.settlementFrom && (
                  <>
                    <span className="text-muted-foreground text-xs">·</span>
                    <span className="text-xs text-amber-500">
                      {snap.settlementFrom} debe{" "}
                      <SensitiveAmount value={formatArs(snap.settlementAmount)} />
                    </span>
                  </>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </PremiumCardContent>
      </PremiumCard>
    </Link>
  );
}
