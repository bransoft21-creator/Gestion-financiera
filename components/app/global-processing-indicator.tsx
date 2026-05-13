"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MeridianLoader } from "@/components/brand/meridian-loader";

export function GlobalProcessingIndicator() {
  const pathname = usePathname();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin === window.location.origin && nextUrl.pathname !== window.location.pathname) {
        setIsProcessing(true);
      }
    }

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsProcessing(false), 0);
    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  useEffect(() => {
    if (!isProcessing) return;

    const timeoutId = window.setTimeout(() => setIsProcessing(false), 8000);
    return () => window.clearTimeout(timeoutId);
  }, [isProcessing]);

  const visible = isProcessing;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-background/10 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div className="v2-card min-w-[140px] rounded-[var(--v2-radius-lg)] px-6 py-5 shadow-2xl shadow-black/30">
        <MeridianLoader size={24} label="Un momento" />
      </div>
    </div>
  );
}
