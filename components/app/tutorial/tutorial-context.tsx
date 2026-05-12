"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { TUTORIAL_STEPS } from "./steps";

const STORAGE_KEY = "fin-os-tutorial-v1";

type TutorialState = {
  active: boolean;
  step: number;
};

type TutorialContextValue = {
  state: TutorialState;
  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  total: number;
};

const TutorialContext = createContext<TutorialContextValue>({
  state: { active: false, step: 0 },
  start: () => {},
  next: () => {},
  back: () => {},
  skip: () => {},
  total: 0,
});

function markSeen() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ seen: true, seenAt: new Date().toISOString() }),
    );
  } catch { /* ignore */ }
}

function hasSeen(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as { seen?: boolean }).seen === true;
  } catch {
    return false;
  }
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TutorialState>({ active: false, step: 0 });
  const pathname = usePathname();

  const start = useCallback(() => {
    setState({ active: true, step: 0 });
  }, []);

  const next = useCallback(() => {
    setState((prev) => {
      const nextStep = prev.step + 1;
      if (nextStep >= TUTORIAL_STEPS.length) {
        markSeen();
        return { active: false, step: 0 };
      }
      return { ...prev, step: nextStep };
    });
  }, []);

  const back = useCallback(() => {
    setState((prev) => ({ ...prev, step: Math.max(0, prev.step - 1) }));
  }, []);

  const skip = useCallback(() => {
    markSeen();
    setState({ active: false, step: 0 });
  }, []);

  useEffect(() => {
    if (pathname !== "/dashboard") return;
    const timer = setTimeout(() => {
      if (!hasSeen()) setState({ active: true, step: 0 });
    }, 1400);
    return () => clearTimeout(timer);
  }, [pathname]);

  const value = useMemo(
    () => ({ state, start, next, back, skip, total: TUTORIAL_STEPS.length }),
    [state, start, next, back, skip],
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial() {
  return useContext(TutorialContext);
}
