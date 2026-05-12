"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { captureClientError, trackProductEvent } from "@/lib/observability/client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureClientError(error, "dashboard", { reason: "global_error" });
    trackProductEvent("app_error", { reason: "global_error" }, "dashboard");
  }, [error]);

  return (
    <html lang="es">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[hsl(230,22%,5.5%)] px-4 text-center font-sans text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
          <AlertTriangle className="h-8 w-8" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold">No pudimos cargar esta vista</h2>
          <p className="max-w-sm text-sm text-white/60">
            Podés reintentar ahora. Si vuelve a pasar, tus datos siguen protegidos.
          </p>
          {error.digest && (
            <p className="text-xs text-white/30">Referencia: {error.digest}</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="v2-focus-ring inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>
          <a
            href="/login"
            className="v2-focus-ring inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-100"
          >
            Ir al inicio
          </a>
        </div>
      </body>
    </html>
  );
}
