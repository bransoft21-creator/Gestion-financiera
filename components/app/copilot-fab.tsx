"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BotMessageSquare } from "lucide-react";
import { useUser } from "./user-context";

export function CopilotFab() {
  const { copilotEnabled } = useUser();
  const pathname = usePathname();
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    function check() {
      setFormOpen(document.body.dataset.appOverlayOpen === "true");
    }
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-app-overlay-open"] });
    return () => observer.disconnect();
  }, []);

  if (!copilotEnabled || pathname === "/copilot" || formOpen) return null;

  return (
    <Link
      href="/copilot"
      aria-label="Abrir Copiloto Financiero"
      style={{ animation: "fab-float 3s ease-in-out infinite" }}
      className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-[115] flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary [box-shadow:0_8px_30px_hsl(var(--primary)/0.35)] transition-shadow duration-200 active:scale-95 lg:hidden"
    >
      <BotMessageSquare className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
    </Link>
  );
}
