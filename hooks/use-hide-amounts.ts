"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "finance-control-hide-amounts";
export const HIDE_AMOUNTS_EVENT = "finance:hideAmountsChange";

export function dispatchHideAmountsChange(hidden: boolean): void {
  window.dispatchEvent(new CustomEvent(HIDE_AMOUNTS_EVENT, { detail: { hidden } }));
}

export function useHideAmounts(): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHidden(window.localStorage.getItem(STORAGE_KEY) === "true");
    }, 0);

    function handleChange(e: Event) {
      setHidden((e as CustomEvent<{ hidden: boolean }>).detail.hidden);
    }

    window.addEventListener(HIDE_AMOUNTS_EVENT, handleChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(HIDE_AMOUNTS_EVENT, handleChange);
    };
  }, []);

  return hidden;
}
