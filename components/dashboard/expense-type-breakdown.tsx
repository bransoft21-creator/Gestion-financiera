"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, Repeat, ShoppingCart, Zap } from "lucide-react";
import {
  PremiumCard,
  PremiumCardContent,
  PremiumCardDescription,
  PremiumCardHeader,
  PremiumCardTitle,
} from "@/components/ui-v2/premium-card";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { formatMoney } from "@/app/(private)/dashboard/utils";
import type { DashboardSummary } from "@/app/(private)/dashboard/types";
import {
  ExpenseTypeDrilldownSheet,
  type DrilldownGroup,
} from "@/components/dashboard/expense-type-drilldown-sheet";

const expenseTypeRows = [
  { key: "fixed" as const, label: "Fijos", icon: Repeat, iconBg: "bg-sky-500/15 text-sky-400", barColor: "#38bdf8" },
  { key: "variable" as const, label: "Variables", icon: ShoppingCart, iconBg: "bg-amber-500/15 text-amber-400", barColor: "#fbbf24" },
  { key: "extraordinary" as const, label: "Extraordinarios", icon: Zap, iconBg: "bg-teal-500/10 text-teal-500", barColor: "#5eead4" },
  { key: "unclassified" as const, label: "Sin clasificar", icon: HelpCircle, iconBg: "bg-secondary text-muted-foreground", barColor: "#6b7280" },
] as const;

export function ExpenseTypeBreakdown({
  expensesByType,
  total,
  income,
  fixedToIncomeRatio,
  year,
  month,
  currency,
}: {
  expensesByType: DashboardSummary["metrics"]["expensesByType"];
  total: number;
  income: number;
  fixedToIncomeRatio: number;
  year: number;
  month: number;
  currency: string;
}) {
  const router = useRouter();
  const [openGroup, setOpenGroup] = useState<DrilldownGroup | null>(null);
  const didReclassify = useRef(false);

  function handleClose() {
    if (didReclassify.current) {
      router.refresh();
      didReclassify.current = false;
    }
    setOpenGroup(null);
  }

  const rows = expenseTypeRows.filter(
    (row) => (row.key === "unclassified" ? expensesByType.unclassified > 0 : true),
  );

  const fixedRatioColor =
    fixedToIncomeRatio >= 60 ? "#f87171"
    : fixedToIncomeRatio >= 40 ? "#fbbf24"
    : "#34d399";
  const fixedRatioTextClass =
    fixedToIncomeRatio >= 60 ? "text-rose-400"
    : fixedToIncomeRatio >= 40 ? "text-amber-400"
    : "text-emerald-400";

  return (
    <>
      <PremiumCard>
        <PremiumCardHeader className="pb-2">
          <PremiumCardTitle className="text-sm">Distribución del gasto</PremiumCardTitle>
          <PremiumCardDescription>Tocá un grupo para ver qué movimientos lo componen.</PremiumCardDescription>
        </PremiumCardHeader>
        <PremiumCardContent className="space-y-3">
          {income > 0 && (
            <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fijos del ingreso
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`text-2xl font-extrabold tabular-nums ${fixedRatioTextClass}`}>
                  {fixedToIncomeRatio}%
                </span>
                <span className="text-xs text-muted-foreground">del ingreso comprometido en fijos</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/60">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(fixedToIncomeRatio, 100)}%`, backgroundColor: fixedRatioColor }}
                />
              </div>
            </div>
          )}
          {rows.map((row) => {
            const value = expensesByType[row.key];
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return (
              <button
                key={row.key}
                type="button"
                onClick={() => setOpenGroup(row.key)}
                className="flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-muted/30 active:bg-muted/50 active:scale-[0.99]"
                aria-label={`Ver detalle: ${row.label}`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${row.iconBg}`}>
                  <row.icon className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-semibold tabular-nums">
                      <SensitiveAmount value={formatMoney(value, currency)} />
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: row.barColor }}
                    />
                  </div>
                </div>
                <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  {pct}%
                </span>
              </button>
            );
          })}
          {total === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Este mes todavía está tranquilo por acá.
            </p>
          )}
        </PremiumCardContent>
      </PremiumCard>

      {openGroup && (
        <ExpenseTypeDrilldownSheet
          isOpen={openGroup !== null}
          onClose={handleClose}
          onTransactionReclassified={() => { didReclassify.current = true; }}
          group={openGroup}
          total={expensesByType[openGroup] ?? 0}
          pct={total > 0 ? Math.round(((expensesByType[openGroup] ?? 0) / total) * 100) : 0}
          year={year}
          month={month}
        />
      )}
    </>
  );
}
