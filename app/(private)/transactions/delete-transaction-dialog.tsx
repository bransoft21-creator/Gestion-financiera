"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { ActionButton } from "@/components/ui-v2/action-button";
import { PremiumCard } from "@/components/ui-v2/premium-card";
import { transactionTypeLabels } from "./constants";
import type { TransactionItem } from "./types";
import { formatMoney, getDisplayAmount } from "./utils";

function useClientMounted() {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

function useLockBodyScroll(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);
}

function useEscapeKey(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);
}

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
  const isMounted = useClientMounted();
  const isOpen = Boolean(transaction);

  useLockBodyScroll(isOpen);
  useEscapeKey(isOpen, onCancel);

  if (!isOpen || !isMounted || !transaction) return null;

  return createPortal(
    // Backdrop: fixed inset-0 at body level — unaffected by any ancestor transform
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
      aria-hidden="true"
    >
      {/* Card: stopPropagation prevents backdrop click on card interaction */}
      <PremiumCard
        variant="raised"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="w-full max-w-md p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="delete-dialog-title" className="text-lg font-semibold text-foreground">Eliminar movimiento</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Se va a quitar este movimiento del feed. La operación usa soft delete.
            </p>
          </div>
        </div>
        <div className="mb-5 rounded-2xl border border-border bg-muted/40 p-3">
          <p className="truncate text-sm font-semibold text-foreground">{transaction.description ?? "Sin descripción"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
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
    </div>,
    document.body,
  );
}
