"use client";

import { ArrowDownCircle, ArrowUpCircle, ReceiptText } from "lucide-react";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { EmptyState } from "@/components/app/empty-state";
import { formatMoney, formatDate } from "@/app/(private)/dashboard/utils";
import type { DashboardSummary } from "@/app/(private)/dashboard/types";

export function RecentTransactions({
  transactions,
}: {
  transactions: DashboardSummary["latestTransactions"];
}) {
  if (!transactions.length) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="Todavía no hay movimientos"
        description="Cuando registrés el primero, tu timeline financiero empieza a construirse."
      />
    );
  }

  return (
    <div>
      {transactions.map((tx, i) => {
        const isIncome = tx.type === "INCOME";
        return (
          <div
            key={tx.id}
            className={`flex items-center gap-3 py-3 ${
              i < transactions.length - 1 ? "border-b border-white/[0.04]" : ""
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                isIncome
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-white/[0.06] text-zinc-400"
              }`}
            >
              {isIncome ? (
                <ArrowUpCircle className="h-[15px] w-[15px]" aria-hidden="true" />
              ) : (
                <ArrowDownCircle className="h-[15px] w-[15px]" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-zinc-100">
                {tx.description ?? "Sin descripción"}
              </p>
              <p className="text-[11px] text-zinc-600">
                {tx.category?.name ?? "Sin categoría"} · {formatDate(tx.occurredAt)}
              </p>
            </div>
            <p
              className={`shrink-0 text-[13px] font-semibold tabular-nums ${
                isIncome ? "text-emerald-400" : "text-zinc-400"
              }`}
            >
              <SensitiveAmount
                value={`${isIncome ? "+" : "−"}${formatMoney(tx.amount, tx.currency)}`}
              />
            </p>
          </div>
        );
      })}
    </div>
  );
}
