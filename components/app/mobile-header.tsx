"use client";

import Link from "next/link";
import { WalletCards } from "lucide-react";
import { LogoutButton } from "./logout-button";
import { NotificationsButton } from "./notifications-button";
import { PrivacyToggle } from "./privacy-toggle";

type MobileHeaderProps = {
  userName?: string | null;
};

export function MobileHeader({ userName }: MobileHeaderProps) {
  const subtitle = userName ? `de ${userName.split(" ")[0]}` : "personal";

  return (
    <header
      className="sticky top-0 z-20 shrink-0 border-b border-border px-4 lg:hidden"
      style={{ background: "var(--surface)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-14 items-center justify-between">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
            <WalletCards className="h-3.5 w-3.5 text-white" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-bold leading-tight text-foreground">
              Gestión de gastos
            </span>
            <span className="block truncate text-[10px] font-medium leading-tight text-muted-foreground">
              Finanzas {subtitle}
            </span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-0.5">
          <PrivacyToggle compact />
          <NotificationsButton compact panelClassName="right-[-38px]" />
          <LogoutButton compact />
        </div>
      </div>
    </header>
  );
}
