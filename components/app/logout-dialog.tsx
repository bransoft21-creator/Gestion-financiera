"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type LogoutDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function LogoutDialog({ open, onClose }: LogoutDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleConfirm() {
    setIsLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      setIsLoading(false);
      onClose();
    }
  }

  // open is always false on initial render (controlled by user interaction),
  // so typeof document check prevents portal call during SSR without needing a mounted state
  if (!open || typeof document === "undefined") return null;

  // Portal to document.body escapes any stacking context (CSS transforms, backdrop-filter, etc.)
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-dialog-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-sm rounded-t-[28px] border border-border bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_24px_80px_rgba(0,0,0,0.20)] sm:rounded-[28px] sm:pb-6">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
          <LogOut className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 id="logout-dialog-title" className="text-lg font-semibold text-foreground">
          ¿Querés cerrar sesión?
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Vas a volver a la pantalla de inicio.</p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isLoading}
            className="flex h-11 w-full min-w-[120px] items-center justify-center gap-2 rounded-2xl bg-destructive text-sm font-semibold text-destructive-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:px-6"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                <span>Cerrando…</span>
              </>
            ) : (
              "Cerrar sesión"
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex h-11 w-full items-center justify-center rounded-2xl border border-border bg-muted/50 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 sm:w-auto sm:px-6"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
