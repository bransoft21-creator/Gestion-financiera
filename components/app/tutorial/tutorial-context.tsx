"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { trackProductEvent } from "@/lib/observability/client";
import { TUTORIAL_STEPS } from "./steps";

const STORAGE_KEY = "fin-os-tutorial-v2";

type TutorialState = {
  active: boolean;
  step: number;
  navigating: boolean;
};

type TutorialContextValue = {
  state: TutorialState;
  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  finish: () => void;
  total: number;
};

const TutorialContext = createContext<TutorialContextValue>({
  state: { active: false, step: 0, navigating: false },
  start: () => {},
  next: () => {},
  back: () => {},
  skip: () => {},
  finish: () => {},
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

function trackEvent(event: string, data?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.debug("[tutorial]", event, data ?? "");
  }
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TutorialState>({ active: false, step: 0, navigating: false });
  const pathname = usePathname();
  const router = useRouter();

  // Refs so callbacks can read current values without stale closures
  const stateRef = useRef(state);
  const pathnameRef = useRef(pathname);

  useEffect(() => { stateRef.current = state; });
  useEffect(() => { pathnameRef.current = pathname; });

  const start = useCallback(() => {
    const firstStep = TUTORIAL_STEPS[0];
    const currentPathname = pathnameRef.current;
    trackEvent("tutorial_start");
    trackProductEvent("tutorial_started", { totalSteps: TUTORIAL_STEPS.length }, "onboarding");
    if (firstStep.route && firstStep.route !== currentPathname) {
      setState({ active: true, step: 0, navigating: true });
      router.push(firstStep.route);
    } else {
      setState({ active: true, step: 0, navigating: false });
    }
  }, [router]);

  const next = useCallback(() => {
    const { step: currentStepIdx } = stateRef.current;
    const nextStepIdx = currentStepIdx + 1;

    if (nextStepIdx >= TUTORIAL_STEPS.length) {
      markSeen();
      trackEvent("tutorial_complete");
      trackProductEvent("tutorial_completed", { totalSteps: TUTORIAL_STEPS.length }, "onboarding");
      setState({ active: false, step: 0, navigating: false });
      return;
    }

    const nextStep = TUTORIAL_STEPS[nextStepIdx];
    const currentPathname = pathnameRef.current;

    trackEvent("tutorial_next", { from: currentStepIdx, to: nextStepIdx, stepId: nextStep.id });

    if (nextStep.route && nextStep.route !== currentPathname) {
      setState({ active: true, step: nextStepIdx, navigating: true });
      router.push(nextStep.route);
    } else {
      setState({ active: true, step: nextStepIdx, navigating: false });
    }
  }, [router]);

  const back = useCallback(() => {
    const { step: currentStepIdx } = stateRef.current;
    if (currentStepIdx === 0) return;

    const prevStepIdx = currentStepIdx - 1;
    const prevStep = TUTORIAL_STEPS[prevStepIdx];
    const currentPathname = pathnameRef.current;

    trackEvent("tutorial_back", { from: currentStepIdx, to: prevStepIdx, stepId: prevStep.id });

    if (prevStep.route && prevStep.route !== currentPathname) {
      setState({ active: true, step: prevStepIdx, navigating: true });
      router.push(prevStep.route);
    } else {
      setState({ active: true, step: prevStepIdx, navigating: false });
    }
  }, [router]);

  const skip = useCallback(() => {
    markSeen();
    const atStep = stateRef.current.step;
    trackEvent("tutorial_skip", { at: atStep });
    trackProductEvent("tutorial_skipped", { step: atStep, totalSteps: TUTORIAL_STEPS.length }, "onboarding");
    setState({ active: false, step: 0, navigating: false });
  }, []);

  const finish = useCallback(() => {
    const { step: currentStepIdx } = stateRef.current;
    const currentStep = TUTORIAL_STEPS[currentStepIdx];
    markSeen();
    trackEvent("tutorial_finish");
    setState({ active: false, step: 0, navigating: false });
    if (currentStep?.ctaRoute) {
      router.push(currentStep.ctaRoute);
    }
  }, [router]);

  // Clear navigating flag once the target route is reached
  useEffect(() => {
    if (!state.navigating) return;
    const currentStep = TUTORIAL_STEPS[state.step];
    if (!currentStep?.route || pathname === currentStep.route) {
      const raf = requestAnimationFrame(() => {
        setState((prev) => (prev.navigating ? { ...prev, navigating: false } : prev));
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [pathname, state.navigating, state.step]);

  // Auto-start on first visit to /dashboard
  useEffect(() => {
    if (pathname !== "/dashboard") return;
    const timer = setTimeout(() => {
      if (!hasSeen()) setState({ active: true, step: 0, navigating: false });
    }, 1400);
    return () => clearTimeout(timer);
  }, [pathname]);

  const value = useMemo(
    () => ({ state, start, next, back, skip, finish, total: TUTORIAL_STEPS.length }),
    [state, start, next, back, skip, finish],
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial() {
  return useContext(TutorialContext);
}
