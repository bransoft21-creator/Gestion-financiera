"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

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
      <div className="flex min-w-[180px] flex-col items-center gap-3 rounded-2xl border border-border/80 bg-card/95 px-5 py-4 text-center shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Procesando</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Un momento</p>
        </div>
      </div>
    </div>
  );
}
