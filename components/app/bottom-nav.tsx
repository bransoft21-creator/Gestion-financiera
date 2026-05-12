"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { useState } from "react";
import {
  BarChart3,
  Bell,
  CircleDollarSign,
  CreditCard,
  FolderTree,
  Gauge,
  Landmark,
  LogOut,
  Menu,
  RefreshCw,
  ScanLine,
  Sparkles,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutDialog } from "./logout-dialog";

const bottomNavItems = [
  { href: "/dashboard",    label: "Hoy",          icon: Gauge },
  { href: "/transactions", label: "Movimientos",  icon: CircleDollarSign },
  { href: "/budgets",      label: "Presupuesto",  icon: BarChart3 },
  { href: "/goals",        label: "Metas",        icon: Sparkles },
] as const;

const moreNavItems = [
  { href: "/smart-import", label: "Smart Import", icon: ScanLine },
  { href: "/accounts",     label: "Dinero",       icon: Landmark },
  { href: "/categories",   label: "Categorías",   icon: FolderTree },
  { href: "/debts",        label: "Deudas",       icon: CreditCard },
  { href: "/recurring",    label: "Recurrentes",  icon: RefreshCw },
  { href: "/notifications", label: "Actividad",   icon: Bell },
  { href: "/reports",      label: "Patrones",     icon: TrendingUp },
  { href: "/profile",      label: "Mi perfil",    icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const isMoreActive = moreNavItems.some((item) => pathname === item.href);

  function handleBottomNavClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (href !== "/dashboard" || pathname !== "/dashboard") return;

    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />

      {/* Overlay */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-[125] bg-black/60"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More drawer */}
      <div
        className={cn(
          "fixed inset-x-0 z-[130] rounded-t-[28px] border-t border-white/10 transition-transform duration-300 ease-out lg:hidden",
          moreOpen ? "translate-y-0" : "translate-y-full",
        )}
        style={{
          bottom: 0,
          background: "rgba(5,8,15,.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <span className="text-[13px] font-semibold text-foreground">Más del sistema</span>
          <button
            type="button"
            onClick={() => setMoreOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-0.5 px-3 pb-[max(env(safe-area-inset-bottom),20px)] pt-1">
          {moreNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex h-12 items-center gap-3 rounded-2xl px-4 text-[14px] font-medium transition-all duration-150",
                  isActive
                    ? "border border-white/10 bg-white/[0.08] text-teal-100"
                    : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className="mt-1 border-t border-white/10 pt-1">
            <button
              type="button"
              onClick={() => { setMoreOpen(false); setLogoutOpen(true); }}
              className="flex h-12 w-full items-center gap-3 rounded-2xl px-4 text-[14px] font-medium text-rose-300 transition-all duration-150 hover:bg-rose-400/10 hover:text-rose-200"
            >
              <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom nav bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-[120] border-t border-white/10 lg:hidden"
        style={{
          background: "rgba(5,8,15,.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div className="grid grid-cols-5 px-1.5 pb-[max(env(safe-area-inset-bottom),6px)] pt-1">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(event) => handleBottomNavClick(event, item.href)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-all duration-150",
                  isActive
                    ? "bg-white/[0.08] text-teal-100"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* Más button */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-all duration-150",
              isMoreActive || moreOpen ? "text-teal-100" : "text-muted-foreground",
            )}
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
            <span className="text-[10px] font-medium">Más</span>
          </button>
        </div>
      </nav>
    </>
  );
}
