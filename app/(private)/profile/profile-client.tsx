"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Shield, Sparkles, User } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ActionButton } from "@/components/ui-v2/action-button";
import { PremiumCard, PremiumCardContent } from "@/components/ui-v2/premium-card";
import { Badge } from "@/components/ui/badge";

type ProfileClientProps = {
  userEmail: string | null;
  userName: string | null;
};

export function ProfileClient({ userEmail, userName }: ProfileClientProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const displayName = userName ?? "Mi cuenta";
  const initials = displayName.slice(0, 2).toUpperCase();

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PremiumCard variant="raised" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_20%_0%,rgba(45,212,191,0.12),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(96,165,250,0.10),transparent_38%)]" />
        <PremiumCardContent className="relative p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.07] text-xl font-bold text-white shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-white">{displayName}</p>
              {userEmail ? (
                <p className="mt-0.5 truncate text-sm text-zinc-400">{userEmail}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge className="border-white/10 bg-white/[0.06] text-zinc-300">
                  <User className="mr-1 h-3 w-3" aria-hidden="true" />
                  Usuario activo
                </Badge>
              </div>
            </div>
          </div>
        </PremiumCardContent>
      </PremiumCard>

      <PremiumCard className="border-teal-300/20 bg-teal-300/[0.04]">
        <PremiumCardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-teal-100">Funciones IA activas</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                Tenés acceso al análisis mensual con IA y Smart Import. El sistema lee tus patrones y genera contexto financiero en tiempo real.
              </p>
            </div>
          </div>
        </PremiumCardContent>
      </PremiumCard>

      <PremiumCard>
        <PremiumCardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-400">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-200">Financial OS</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Tus datos financieros son privados y están protegidos. El sistema nunca comparte información con terceros.
              </p>
            </div>
          </div>
        </PremiumCardContent>
      </PremiumCard>

      <PremiumCard className="border-rose-300/10">
        <PremiumCardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-200">Cerrar sesión</p>
              <p className="mt-0.5 text-xs text-zinc-500">Salir de esta cuenta en este dispositivo.</p>
            </div>
            <ActionButton
              type="button"
              variant="danger"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="w-full sm:w-auto"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {isLoggingOut ? "Cerrando..." : "Cerrar sesión"}
            </ActionButton>
          </div>
        </PremiumCardContent>
      </PremiumCard>
    </div>
  );
}
