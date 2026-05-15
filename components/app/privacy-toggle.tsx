"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dispatchHideAmountsChange } from "@/hooks/use-hide-amounts";
import { trackProductEvent } from "@/lib/observability/client";

const STORAGE_KEY = "finance-control-hide-amounts";

type PrivacyToggleProps = {
  compact?: boolean;
  className?: string;
};

export function PrivacyToggle({ compact = false, className }: PrivacyToggleProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY) === "true";
      setHidden(stored);
      document.documentElement.dataset.hideAmounts = String(stored);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  function toggleHidden() {
    const next = !hidden;
    setHidden(next);
    window.localStorage.setItem(STORAGE_KEY, String(next));
    document.documentElement.dataset.hideAmounts = String(next);
    dispatchHideAmountsChange(next);
    trackProductEvent("hide_amounts_toggled", { status: next ? "hidden" : "visible" }, "analytics");
  }

  const Icon = hidden ? EyeOff : Eye;

  return (
    <Button
      type="button"
      variant={compact ? "ghost" : "secondary"}
      size={compact ? "icon" : "sm"}
      className={cn(
        compact && "h-9 w-9 rounded-full border-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        !compact && "rounded-full bg-secondary/70 px-3 text-muted-foreground hover:text-foreground",
        className,
      )}
      onClick={toggleHidden}
      aria-pressed={hidden}
      aria-label={hidden ? "Mostrar montos" : "Ocultar montos"}
      title={hidden ? "Mostrar montos" : "Ocultar montos"}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {compact ? null : hidden ? "Mostrar montos" : "Ocultar montos"}
    </Button>
  );
}
