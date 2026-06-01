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
    <Link
      href="/copilot"
      aria-label="Abrir Copiloto Financiero"
      className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-4 z-[115] flex items-center gap-2.5 rounded-full border border-primary/30 bg-primary px-4 py-3 shadow-[0_8px_30px_rgba(45,212,191,0.35)] transition-all duration-200 active:scale-95 lg:hidden"
    >
      <BotMessageSquare className="h-5 w-5 shrink-0 text-primary-foreground" aria-hidden="true" />
      <span className="text-[13px] font-semibold text-primary-foreground">Copiloto</span>
    </Link>
  );
}
