"use client";

import { Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { ActionButton } from "@/components/ui-v2/action-button";
import { PremiumCard } from "@/components/ui-v2/premium-card";
import { transactionTypeLabels } from "./constants";
import type { TransactionItem } from "./types";
import { formatMoney, getDisplayAmount } from "./utils";

export function DeleteTransactionDialog({
  transaction,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  transaction: TransactionItem | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!transaction) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center">
      <PremiumCard variant="raised" className="w-full max-w-md p-5">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-300/12 text-rose-100">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">Eliminar movimiento</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              Se va a quitar este movimiento del feed. La operación usa soft delete.
            </p>
          </div>
        </div>
        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
          <p className="truncate text-sm font-semibold text-zinc-100">{transaction.description ?? "Sin descripción"}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {transactionTypeLabels[transaction.type]} ·{" "}
            <SensitiveAmount value={formatMoney(getDisplayAmount(transaction), transaction.currency)} />
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <ActionButton type="button" variant="glass" onClick={onCancel} disabled={isDeleting}>
            Cancelar
          </ActionButton>
          <ActionButton type="button" variant="danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
            Eliminar
          </ActionButton>
        </div>
      </PremiumCard>
    </div>
  );
}
