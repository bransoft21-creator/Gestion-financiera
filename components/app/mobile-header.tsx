"use client";

import Link from "next/link";
import { Bell, WalletCards } from "lucide-react";

export function MobileHeader() {
  return (
    <header
      className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border px-4 lg:hidden"
      style={{ background: "var(--surface)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      <Link href="/dashboard" className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
          <WalletCards className="h-3.5 w-3.5 text-white" aria-hidden="true" />
        </span>
        <span className="text-[14px] font-bold text-foreground">Finance Control</span>
      </Link>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center text-muted-foreground"
        aria-label="Notificaciones"
      >
        <Bell className="h-[19px] w-[19px]" aria-hidden="true" />
      </button>
    </header>
  );
}
