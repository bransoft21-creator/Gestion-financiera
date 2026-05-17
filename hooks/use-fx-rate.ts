"use client";

import { useState, useEffect } from "react";

const LS_KEY = "meridian-fx-rate-usd-ars-v1";
const DEFAULT_RATE = 1200;

export function useFxRate() {
  const [rate, setRateState] = useState<number>(DEFAULT_RATE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        const parsed = Number(stored);
        if (Number.isFinite(parsed) && parsed > 0) {
          setRateState(parsed);
        }
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function setRate(value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    setRateState(value);
    localStorage.setItem(LS_KEY, String(value));
  }

  return { rate, setRate, loaded };
}
