"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { setTelemetryUser, trackProductEvent } from "@/lib/observability/client";

export function TelemetryProvider({ userId }: { userId?: string | null }) {
  const pathname = usePathname();

  useEffect(() => {
    setTelemetryUser(userId);
  }, [userId]);

  useEffect(() => {
    if (!pathname) return;
    trackProductEvent("route_viewed", { route: pathname }, routeArea(pathname));
  }, [pathname]);

  return null;
}

function routeArea(pathname: string) {
  if (pathname.includes("smart-import")) return "smart-import";
  if (pathname.includes("dashboard")) return "dashboard";
  if (pathname.includes("onboarding")) return "onboarding";
  if (pathname.includes("login") || pathname.includes("auth")) return "auth";
  return "analytics";
}
