"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivateError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to server monitoring (Sentry, etc.) when integrated
    console.error("[app-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-8 w-8" aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight">Algo salió mal</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ocurrió un error inesperado en esta página. Podés intentar recargarla o volver al inicio.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/50">Referencia: {error.digest}</p>
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reintentar
        </Button>
        <Button asChild>
          <a href="/dashboard">Ir al inicio</a>
        </Button>
      </div>
    </div>
  );
}
