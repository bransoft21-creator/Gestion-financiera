"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export function GlobalProcessingIndicator() {
  const pathname = usePathname();
  const [isProcessing, setIsProcessing] = useState(false);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      setFetchCount((count) => count + 1);
      try {
        return await originalFetch(...args);
      } finally {
        setFetchCount((count) => Math.max(0, count - 1));
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

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

  const visible = isProcessing || fetchCount > 0;

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-[80] transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div className="h-[3px] overflow-hidden bg-primary/10">
        <div className="h-full w-1/2 animate-processing-bar rounded-r-full bg-gradient-to-r from-violet-500 via-sky-400 to-emerald-400" />
      </div>
      <div className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-lg shadow-black/20 backdrop-blur">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
        Procesando
      </div>
    </div>
  );
}
