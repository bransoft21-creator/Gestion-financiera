"use client";

import { useState } from "react";
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

  if (!open) return null;

  return (
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
      <div className="relative w-full max-w-sm rounded-t-[28px] border border-white/10 bg-zinc-950 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:rounded-[28px]">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-400/[0.12] text-rose-200">
          <LogOut className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 id="logout-dialog-title" className="text-lg font-semibold text-white">
          ¿Querés cerrar sesión?
        </h2>
        <p className="mt-1.5 text-sm text-zinc-400">Vas a volver a la pantalla de inicio.</p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isLoading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-6"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {isLoading ? "Cerrando..." : "Cerrar sesión"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.08] disabled:opacity-60 sm:w-auto sm:px-6"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
