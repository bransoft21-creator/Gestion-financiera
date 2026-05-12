"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { trackProductEvent } from "@/lib/observability/client";

export function OnlineStatusBanner() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const handleOffline = () => {
      setOnline(false);
      trackProductEvent("offline_detected", { area: "mobile" }, "mobile");
    };
    const handleOnline = () => {
      setOnline(true);
      trackProductEvent("online_restored", { area: "mobile" }, "mobile");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed inset-x-4 top-[calc(64px+env(safe-area-inset-top))] z-[140] rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100 shadow-2xl backdrop-blur-xl lg:left-auto lg:right-6 lg:top-6 lg:max-w-sm">
      <div className="flex items-start gap-3">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>Sin conexión. Podés seguir mirando la app; para guardar o importar necesitás volver online.</p>
      </div>
    </div>
  );
}
