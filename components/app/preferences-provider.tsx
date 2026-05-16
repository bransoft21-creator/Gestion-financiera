"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useTheme } from "next-themes";

type Preferences = {
  theme: "system" | "dark" | "light";
  textSize: "normal" | "large";
  language: "es" | "en";
  primaryCurrency: "ARS" | "USD";
  onboardingGoals: string[];
};

type PreferencesContextValue = {
  preferences: Preferences | null;
  updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: null,
  updatePreference: async () => {},
});

export function usePreferences() {
  return useContext(PreferencesContext);
}

const DEFAULT_PREFS: Preferences = {
  theme: "dark",
  textSize: "normal",
  language: "es",
  primaryCurrency: "ARS",
  onboardingGoals: [],
};

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const { setTheme } = useTheme();

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/user/preferences");
        if (!res.ok) return;
        const payload = (await res.json()) as { data?: Preferences };
        if (payload.data) {
          setPreferences(payload.data);
          applyTextSize(payload.data.textSize);
          setTheme(payload.data.theme);
        }
      } catch {
        // silently fall back to defaults
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updatePreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    const next = { ...(preferences ?? DEFAULT_PREFS), [key]: value };
    setPreferences(next);

    if (key === "textSize") applyTextSize(value as string);
    if (key === "theme") setTheme(value as string);

    try {
      await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key === "primaryCurrency" ? "primaryCurrency" : key]: value }),
      });
    } catch {
      // revert optimistic update on error
      setPreferences(preferences);
    }
  }

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreference }}>
      {children}
    </PreferencesContext.Provider>
  );
}

function applyTextSize(size: string) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (size === "large") {
    html.setAttribute("data-text-size", "large");
  } else {
    html.removeAttribute("data-text-size");
  }
}
