"use client";

import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "./logout-button";
import { NotificationsButton } from "./notifications-button";
import { PrivacyToggle } from "./privacy-toggle";

type MobileHeaderProps = {
  userName?: string | null;
};

export function MobileHeader({ userName }: MobileHeaderProps) {
  const subtitle = userName ? `para ${userName.split(" ")[0]}` : "personal";

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-white/10 bg-zinc-950/80 px-4 backdrop-blur-xl lg:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex h-14 items-center justify-between">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
          <Image src="/icons/Meridian.png" alt="Meridian" width={28} height={28} className="shrink-0 select-none" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-bold leading-tight text-foreground">
              Meridian
            </span>
            <span className="block truncate text-xs font-medium leading-tight text-muted-foreground">
              Copilot {subtitle}
            </span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-0.5">
          <span data-tutorial="privacy-toggle-mobile">
            <PrivacyToggle compact />
          </span>
          <span data-tutorial="notifications-mobile">
            <NotificationsButton compact panelClassName="fixed left-3 right-3 w-auto top-[calc(env(safe-area-inset-top)+3.5rem+8px)]" />
          </span>
          <LogoutButton compact />
        </div>
      </div>
    </header>
  );
}
