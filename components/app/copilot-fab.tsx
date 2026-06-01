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
      style={{ animation: "fab-float 3s ease-in-out infinite" }}
      className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-[115] flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary shadow-[0_8px_30px_rgba(45,212,191,0.35)] transition-shadow duration-200 active:scale-95 lg:hidden"
    >
      <BotMessageSquare className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
    </Link>
  );
}
