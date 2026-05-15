"use client";

import { ArrowDownCircle, ArrowRightLeft, ArrowUpCircle, ReceiptText } from "lucide-react";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { EmptyState } from "@/components/app/empty-state";
import { formatMoney, formatDate } from "@/app/(private)/dashboard/utils";
import type { DashboardSummary } from "@/app/(private)/dashboard/types";

type TxType = DashboardSummary["latestTransactions"][number]["type"];

function txStyle(type: TxType) {
  if (type === "INCOME") return { icon: "bg-emerald-500/10 text-emerald-400", amount: "text-emerald-400", prefix: "+" };
  if (type === "TRANSFER") return { icon: "bg-teal-500/10 text-teal-400", amount: "text-teal-400", prefix: "" };
  return { icon: "bg-rose-500/10 text-rose-400", amount: "text-rose-400", prefix: "−" };
}

function TxIcon({ type }: { type: TxType }) {
  if (type === "INCOME") return <ArrowUpCircle className="h-[15px] w-[15px]" aria-hidden="true" />;
  if (type === "TRANSFER") return <ArrowRightLeft className="h-[15px] w-[15px]" aria-hidden="true" />;
  return <ArrowDownCircle className="h-[15px] w-[15px]" aria-hidden="true" />;
}

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
        const style = txStyle(tx.type);
        return (
          <div
            key={tx.id}
            className={`flex items-center gap-3 py-3 ${
              i < transactions.length - 1 ? "border-b border-white/[0.04]" : ""
            }`}
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${style.icon}`}>
              <TxIcon type={tx.type} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-zinc-100">
                {tx.description ?? "Sin descripción"}
              </p>
              <p className="text-[11px] text-zinc-600">
                {tx.category?.name ?? "Sin categoría"} · {formatDate(tx.occurredAt)}
              </p>
            </div>
            <p className={`shrink-0 text-[13px] font-semibold tabular-nums ${style.amount}`}>
              <SensitiveAmount
                value={`${style.prefix}${formatMoney(tx.amount, tx.currency)}`}
              />
            </p>
          </div>
        );
      })}
    </div>
  );
}
