"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";
import { LogoutButton } from "./logout-button";

type SidebarProps = {
  userName?: string | null;
  userEmail?: string | null;
};

export function Sidebar({ userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const displayName = userName ?? "Mi cuenta";
  const accountLabel = userEmail ?? "Hogar principal";

  return (
    <aside data-tutorial="nav-desktop" className="hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-zinc-950/74 shadow-[1px_0_34px_rgba(0,0,0,0.34)] backdrop-blur-xl lg:sticky lg:top-0 lg:flex">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-[18px]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] text-teal-100 shadow-[0_10px_34px_rgba(45,212,191,0.12)]">
          <Sparkles className="h-[17px] w-[17px]" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[13px] font-bold leading-tight text-foreground">Financial OS</p>
          <p className="text-[11px] leading-tight text-muted-foreground">Lectura diaria</p>
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
                "mb-[3px] flex h-[40px] items-center gap-2.5 rounded-2xl border border-transparent px-3 text-[13px] font-medium transition-all duration-150",
                isActive
                  ? "border-white/10 bg-white/[0.07] text-teal-100 shadow-[0_10px_30px_rgba(45,212,191,0.07)]"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Inversiones — pronto */}
        <div
          className="mb-[3px] flex h-[40px] cursor-default items-center gap-2.5 rounded-2xl border border-transparent px-3 text-[13px] font-medium text-muted-foreground/50"
        >
          <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">Inversiones</span>
          <span className="rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Pronto
          </span>
        </div>
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-white/10 px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.07]">
            <span className="text-[11px] font-bold text-white">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-foreground">{displayName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{accountLabel}</p>
          </div>
          <LogoutButton compact />
        </div>
      </div>
    </aside>
  );
}
