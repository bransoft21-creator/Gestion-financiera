"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CircleDollarSign, Gauge, Menu, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const bottomNavItems = [
  { href: "/dashboard",    label: "Inicio",       icon: Gauge },
  { href: "/transactions", label: "Movimientos",  icon: CircleDollarSign },
  { href: "/budgets",      label: "Presupuesto",  icon: BarChart3 },
  { href: "/goals",        label: "Metas",        icon: Sparkles },
  { href: "/more",         label: "Más",          icon: Menu },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border lg:hidden"
      style={{
        background: "rgba(9,11,20,.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <div className="grid grid-cols-5 px-1.5 pb-[max(env(safe-area-inset-bottom),6px)] pt-1">
        {bottomNavItems.map((item) => {
          const isActive = item.href !== "/more" && pathname === item.href;
          const Icon = item.icon;

          const inner = (
            <>
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </>
          );

          if (item.href === "/more") {
            return (
              <button
                key={item.href}
                type="button"
                className="flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-muted-foreground"
              >
                {inner}
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition-all duration-150",
                isActive
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground",
              )}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
