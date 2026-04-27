"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";
import { LogoutButton } from "./logout-button";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card shadow-[1px_0_20px_rgba(0,0,0,0.3)] lg:sticky lg:top-0 lg:flex">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-[18px]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-violet-600 to-indigo-600 shadow-[0_4px_14px_rgba(124,58,237,.35)]">
          <WalletCards className="h-[17px] w-[17px] text-white" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[13px] font-bold leading-tight text-foreground">Finance Control</p>
          <p className="text-[11px] leading-tight text-muted-foreground">Panel financiero</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-[38px] items-center gap-2.5 rounded-[9px] border-l-2 px-3 text-[13px] font-medium transition-all duration-150 mb-[1px]",
                isActive
                  ? "border-l-primary bg-primary/13 text-primary"
                  : "border-l-transparent text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Inversiones — pronto */}
        <div
          className="flex h-[38px] cursor-default items-center gap-2.5 rounded-[9px] border-l-2 border-l-transparent px-3 text-[13px] font-medium text-muted-foreground/50 mb-[1px]"
        >
          <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">Inversiones</span>
          <span className="rounded-full bg-white/7 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Pronto
          </span>
        </div>
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-border px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600">
            <span className="text-[11px] font-bold text-white">U</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-foreground">Mi cuenta</p>
            <p className="text-[11px] text-muted-foreground">Hogar principal</p>
          </div>
          <LogoutButton compact />
        </div>
      </div>
    </aside>
  );
}
