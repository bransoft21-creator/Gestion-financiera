"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";
import { LogoutDialog } from "./logout-dialog";
import type { AwarenessSignal, NavigationAwareness } from "@/lib/navigation-awareness";

const bottomNavItems = navItems.filter((item) => item.mobile === "primary");
const drawerSections = [
  { tier: "core", label: "También diario" },
  { tier: "weekly", label: "Plan y compromisos" },
  { tier: "advanced", label: "Sistema" },
] as const;

export function BottomNav({ awareness }: { awareness?: NavigationAwareness }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const drawerItems = navItems.filter((item) => item.mobile !== "primary");
  const isMoreActive = drawerItems.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const moreHasSignal = drawerItems.some((item) => item.awarenessTarget && awareness?.signals[item.awarenessTarget]);

  function handleBottomNavClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (href !== "/dashboard" || pathname !== "/dashboard") return;

    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />

      {moreOpen && (
        <div
          className="fixed inset-0 z-[125] bg-black/60"
          onClick={() => setMoreOpen(false)}
        />
      )}

      <div
        data-bottom-drawer
        className={cn(
          "fixed inset-x-0 z-[130] max-h-[82vh] overflow-y-auto rounded-t-[28px] border-t border-border transition-transform duration-300 ease-out lg:hidden",
          moreOpen ? "translate-y-0" : "translate-y-full",
        )}
        style={{
          bottom: 0,
          background: "hsl(var(--background) / 0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <span className="text-[13px] font-semibold text-foreground">Más de Meridian</span>
          <button
            type="button"
            onClick={() => setMoreOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground"
            aria-label="Cerrar navegación"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-4 px-3 pb-[max(env(safe-area-inset-bottom),20px)] pt-1">
          {drawerSections.map((section) => {
            const items = drawerItems.filter((item) => item.tier === section.tier);
            if (items.length === 0) return null;

            return (
              <div key={section.tier}>
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {section.label}
                </p>
                <div className="grid grid-cols-1 gap-0.5">
                  {items.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/settings" && pathname.startsWith(`${item.href}/`));
                    const Icon = item.icon;
                    const signal = item.awarenessTarget ? awareness?.signals[item.awarenessTarget] : undefined;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          "flex h-12 items-center gap-3 rounded-2xl px-4 text-[14px] font-medium transition-all duration-150",
                          item.featured && !isActive && "bg-primary/[0.06] text-foreground",
                          isActive
                            ? "border border-border bg-muted/70 text-primary"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <AwarenessBadge signal={signal} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="border-t border-border pt-1">
            <button
              type="button"
              onClick={() => { setMoreOpen(false); setLogoutOpen(true); }}
              className="flex h-12 w-full items-center gap-3 rounded-2xl px-4 text-[14px] font-medium text-destructive transition-all duration-150 hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>

      <nav
        data-bottom-nav
        data-tutorial="nav-mobile"
        className="fixed inset-x-0 bottom-0 z-[120] border-t border-border transition-all duration-300 ease-out lg:hidden"
        style={{
          background: "hsl(var(--background) / 0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div className="grid grid-cols-5 px-1.5 pb-[max(env(safe-area-inset-bottom),6px)] pt-1">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const signal = item.awarenessTarget ? awareness?.signals[item.awarenessTarget] : undefined;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(event) => handleBottomNavClick(event, item.href)}
                className={cn(
                  "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-all duration-200 active:scale-95",
                  item.featured && !isActive && "text-foreground",
                  isActive ? "text-primary" : "text-muted-foreground active:text-foreground",
                )}
              >
                {isActive && (
                  <span className="absolute inset-x-2 top-0 h-[2px] rounded-b-full bg-teal-400/70 transition-all duration-200" />
                )}
                <span className="relative">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                  <AwarenessDot signal={signal} />
                </span>
                <span className={cn(
                  "max-w-full truncate text-[10px] font-medium transition-colors duration-200",
                  isActive ? "text-primary/80" : "",
                )}>
                  {item.shortLabel}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-all duration-200 active:scale-95",
              isMoreActive || moreOpen ? "text-primary" : "text-muted-foreground active:text-foreground",
            )}
          >
            {(isMoreActive || moreOpen) && (
              <span className="absolute inset-x-2 top-0 h-[2px] rounded-b-full bg-teal-400/70 transition-all duration-200" />
            )}
            <span className="relative">
              <Menu className="h-6 w-6" aria-hidden="true" />
              {moreHasSignal ? <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-amber-400/80" /> : null}
            </span>
            <span className={cn(
              "text-[10px] font-medium transition-colors duration-200",
              isMoreActive || moreOpen ? "text-primary/80" : "",
            )}>
              Más
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

function AwarenessDot({ signal }: { signal?: AwarenessSignal }) {
  if (!signal) return null;

  return (
    <span
      className={cn(
        "absolute -right-1 -top-0.5 h-2 w-2 rounded-full",
        signal.tone === "attention" ? "bg-amber-400/80" : "bg-primary/70",
      )}
      aria-label={signal.label}
      title={signal.label}
    />
  );
}

function AwarenessBadge({ signal }: { signal?: AwarenessSignal }) {
  if (!signal) return null;

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
