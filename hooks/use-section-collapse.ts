"use client";

import { useEffect, useState } from "react";

export function useSectionCollapse(id: string, defaultExpanded = true) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(`dashboard-section-${id}`);
      if (stored !== null) setExpanded(stored === "true");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  function toggle() {
    setExpanded((current) => {
      const next = !current;
      window.localStorage.setItem(`dashboard-section-${id}`, String(next));
      return next;
    });
  }

  return { expanded, toggle };
}
