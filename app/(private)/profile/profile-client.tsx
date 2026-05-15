"use client";

import { useState } from "react";
import { LogOut, Mail, Settings, Sparkles, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ActionButton } from "@/components/ui-v2/action-button";
import { PremiumCard, PremiumCardContent } from "@/components/ui-v2/premium-card";
import { Badge } from "@/components/ui/badge";
import { LogoutDialog } from "@/components/app/logout-dialog";

type ProfileClientProps = {
  userEmail: string | null;
  userName: string | null;
  avatarUrl?: string | null;
  provider?: string | null;
  isAiEnabled?: boolean;
};

export function ProfileClient({
  userEmail,
  userName,
  avatarUrl,
  provider = "email",
  isAiEnabled = false,
}: ProfileClientProps) {
  const [logoutOpen, setLogoutOpen] = useState(false);

  const displayName = userName ?? "Mi cuenta";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const providerLabel = provider === "google" ? "Google" : "Email";

  return (
    <>
      <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />

      <div className="mx-auto max-w-lg space-y-4">

        {/* Identity card */}
        <PremiumCard variant="raised" className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_20%_0%,rgba(45,212,191,0.12),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(96,165,250,0.10),transparent_38%)]" />
          <PremiumCardContent className="relative p-6 sm:p-8">
            <div className="flex items-start gap-5">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  width={80}
                  height={80}
                  className="h-20 w-20 shrink-0 rounded-3xl border border-white/10 object-cover shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.07] text-2xl font-bold text-white shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                  {initials || <User className="h-8 w-8" aria-hidden="true" />}
                </div>
              )}

              <div className="min-w-0 flex-1 pt-1">
                <h2 className="text-xl font-bold leading-tight text-white sm:text-2xl">
                  {displayName}
                </h2>
                {userEmail ? (
                  <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-zinc-400">
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {userEmail}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge className="border-white/10 bg-white/[0.06] text-zinc-300">
                    <User className="mr-1 h-3 w-3" aria-hidden="true" />
                    Cuenta activa
                  </Badge>
                  <Badge className="border-white/10 bg-white/[0.06] text-zinc-400">
                    {providerLabel}
                  </Badge>
                  {isAiEnabled && (
                    <Badge className="border-teal-300/20 bg-teal-300/10 text-teal-200">
                      <Sparkles className="mr-1 h-3 w-3" aria-hidden="true" />
                      Beta IA
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </PremiumCardContent>
        </PremiumCard>

        {/* AI Status */}
        {isAiEnabled ? (
          <PremiumCard className="border-teal-300/20 bg-teal-300/[0.04]">
            <PremiumCardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-teal-100">Funciones IA activas</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">
                    Tenés acceso al análisis mensual con IA y Smart Import.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {["IA habilitada", "Beta activa", "Smart Import disponible"].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-teal-300/20 bg-teal-300/10 px-2.5 py-0.5 text-[11px] font-medium text-teal-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </PremiumCardContent>
          </PremiumCard>
        ) : (
          <PremiumCard>
            <PremiumCardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-500">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-300">Funciones IA no disponibles</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Las funciones de IA están disponibles para usuarios beta. Tu cuenta está en lista de espera.
                  </p>
                </div>
              </div>
            </PremiumCardContent>
          </PremiumCard>
        )}

        {/* Actions */}
        <PremiumCard>
          <PremiumCardContent className="divide-y divide-white/[0.06] p-0">
            {/* Ajustes */}
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400">
                  <Settings className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">Ajustes</p>
                  <p className="text-xs text-zinc-500">Apariencia, región, privacidad y más.</p>
                </div>
              </div>
              <Link
                href="/settings"
                className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
              >
                Ir a ajustes
              </Link>
            </div>

            {/* Cerrar sesión */}
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-zinc-200">Cerrar sesión</p>
                <p className="mt-0.5 text-xs text-zinc-500">Salir de esta cuenta en este dispositivo.</p>
              </div>
              <ActionButton
                variant="danger"
                size="sm"
                onClick={() => setLogoutOpen(true)}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Cerrar sesión
              </ActionButton>
            </div>
          </PremiumCardContent>
        </PremiumCard>

      </div>
    </>
  );
}
