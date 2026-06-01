"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BotMessageSquare } from "lucide-react";
import { useUser } from "./user-context";

export function CopilotFab() {
  const { copilotEnabled } = useUser();
  const pathname = usePathname();

  if (!copilotEnabled || pathname === "/copilot") return null;

  return (
    <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-[115] lg:hidden">
      {/* Ping ring */}
      <span className="absolute inset-0 rounded-full bg-primary opacity-30 animate-ping" />
      <Link
        href="/copilot"
        aria-label="Abrir Copiloto Financiero"
        className="relative flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary shadow-[0_8px_30px_rgba(45,212,191,0.35)] transition-all duration-200 active:scale-95"
      >
        <BotMessageSquare className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
      </Link>
    </div>
  );
}
