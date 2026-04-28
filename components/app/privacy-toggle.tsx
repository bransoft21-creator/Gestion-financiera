"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "finance-control-hide-amounts";

type PrivacyToggleProps = {
  compact?: boolean;
};

export function PrivacyToggle({ compact = false }: PrivacyToggleProps) {
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
  }

  const Icon = hidden ? EyeOff : Eye;

  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon" : "sm"}
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
