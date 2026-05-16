"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";
import { LogoutButton } from "./logout-button";
import type { AwarenessSignal, NavigationAwareness } from "@/lib/navigation-awareness";

type SidebarProps = {
  userName?: string | null;
  userEmail?: string | null;
  awareness?: NavigationAwareness;
};

const sectionLabels = {
  core: "Diario",
  weekly: "Plan",
  advanced: "Sistema",
} as const;

const navSections = (["core", "weekly", "advanced"] as const).map((tier) => ({
  tier,
  label: sectionLabels[tier],
  items: navItems.filter((item) => item.tier === tier),
}));

export function Sidebar({ userName, userEmail, awareness }: SidebarProps) {
  const pathname = usePathname();
  const displayName = userName ?? "Mi cuenta";
  const accountLabel = userEmail ?? "Hogar principal";

  return (
    <aside data-tutorial="nav-desktop" className="hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-background/95 shadow-[1px_0_34px_rgba(0,0,0,0.34)] backdrop-blur-xl lg:sticky lg:top-0 lg:flex">
      {/* Logo */}
      <div className="flex h-[68px] shrink-0 items-center gap-3 border-b border-border px-5">
        <Image src="/icons/Meridian.png" alt="Meridian" width={40} height={40} className="shrink-0 select-none" />
        <div>
          <p className="text-[14px] font-semibold leading-snug tracking-tight text-foreground">Meridian</p>
          <p className="text-[12px] leading-snug text-muted-foreground">Perspectiva diaria</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navSections.map((section) => (
          <div key={section.tier} className="mb-4 last:mb-1">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {section.label}
            </p>
            {section.items.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/settings" && pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;
              const signal = item.awarenessTarget ? awareness?.signals[item.awarenessTarget] : undefined;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "mb-[3px] flex h-[40px] items-center gap-2.5 rounded-2xl border border-transparent px-3 text-[13px] font-medium transition-all duration-150",
                    item.featured && !isActive && "bg-primary/[0.06] text-foreground hover:bg-primary/[0.1]",
                    isActive
                      ? "border-border bg-muted/60 text-primary shadow-[0_10px_30px_rgba(45,212,191,0.07)]"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <AwarenessBadge signal={signal} compact={section.tier === "core"} />
                </Link>
              );
            })}
          </div>
        ))}

        {/* Inversiones — pronto */}
        <div
          className="mb-[3px] flex h-[40px] cursor-default items-center gap-2.5 rounded-2xl border border-transparent px-3 text-[13px] font-medium text-muted-foreground/50"
        >
          <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">Inversiones</span>
          <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            Pronto
          </span>
        </div>
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-border px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted/60">
            <span className="text-xs font-bold text-foreground">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-foreground">{displayName}</p>
            <p className="truncate text-[12px] text-muted-foreground">{accountLabel}</p>
          </div>
          <LogoutButton compact />
        </div>
      </div>
    </aside>
  );
}

function AwarenessBadge({
  signal,
  compact = false,
}: {
  signal?: AwarenessSignal;
  compact?: boolean;
}) {
  if (!signal) return null;

  if (compact && signal.count > 0) {
    return (
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          signal.tone === "attention" ? "bg-amber-400/80" : "bg-primary/70",
        )}
        aria-label={signal.label}
        title={signal.label}
      />
    );
  }

  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none",
        signal.tone === "attention"
          ? "border-amber-300/20 bg-amber-300/10 text-amber-500"
          : "border-border bg-muted/50 text-muted-foreground",
      )}
    >
      {signal.label}
    </span>
  );
}
