"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTutorial } from "./tutorial-context";
import { TUTORIAL_STEPS } from "./steps";

const TOOLTIP_W = 288;
const TOOLTIP_H = 210;
const MARGIN = 16;
const GAP = 14;
const SPOTLIGHT_R = 14;
const EASE = [0.22, 1, 0.36, 1] as const;

type Rect = { x: number; y: number; w: number; h: number };
type Placement = "above" | "below" | "left" | "right" | "center";

function findVisibleEl(selectors: string[]): Element | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    } catch { /* ignore */ }
  }
  return null;
}

function toRect(el: Element, pad: number): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.x - pad, y: r.y - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

function getPlacement(rect: Rect, vw: number, vh: number): Placement {
  const ab = rect.y - MARGIN;
  const bel = vh - (rect.y + rect.h) - MARGIN;
  const le = rect.x - MARGIN;
  const ri = vw - (rect.x + rect.w) - MARGIN;
  if (bel >= TOOLTIP_H + GAP) return "below";
  if (ab >= TOOLTIP_H + GAP) return "above";
  if (ri >= TOOLTIP_W + GAP) return "right";
  if (le >= TOOLTIP_W + GAP) return "left";
  return "center";
}

function tooltipXY(rect: Rect, pl: Placement, vw: number, vh: number): { x: number; y: number } {
  const tw = Math.min(TOOLTIP_W, vw - MARGIN * 2);
  switch (pl) {
    case "below":
      return {
        x: clamp(rect.x + rect.w / 2 - tw / 2, MARGIN, vw - tw - MARGIN),
        y: rect.y + rect.h + GAP,
      };
    case "above":
      return {
        x: clamp(rect.x + rect.w / 2 - tw / 2, MARGIN, vw - tw - MARGIN),
        y: rect.y - TOOLTIP_H - GAP,
      };
    case "right":
      return {
        x: rect.x + rect.w + GAP,
        y: clamp(rect.y + rect.h / 2 - TOOLTIP_H / 2, MARGIN, vh - TOOLTIP_H - MARGIN),
      };
    case "left":
      return {
        x: rect.x - tw - GAP,
        y: clamp(rect.y + rect.h / 2 - TOOLTIP_H / 2, MARGIN, vh - TOOLTIP_H - MARGIN),
      };
    default:
      return { x: vw / 2 - tw / 2, y: clamp(vh / 2 - TOOLTIP_H / 2, MARGIN, vh - TOOLTIP_H - MARGIN) };
  }
}

export function TutorialSpotlight() {
  const { state, next, back, skip, total } = useTutorial();
  const [spotRect, setSpotRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const shouldReduce = useReducedMotion();
  const prevStep = useRef(state.step);

  const currentStep = TUTORIAL_STEPS[state.step];
  const isOverlay = !currentStep?.targets?.length || currentStep.type === "overlay";
  const isFirst = state.step === 0;
  const isLast = state.step === total - 1;

  const measure = useCallback(() => {
    if (!currentStep?.targets?.length || isOverlay) { setSpotRect(null); return null; }
    const el = findVisibleEl(currentStep.targets);
    if (!el) { setSpotRect(null); return null; }
    const rect = toRect(el, currentStep.highlightPadding ?? 8);
    setSpotRect(rect);
    return { el, rect };
  }, [currentStep, isOverlay]);

  // Reset spotlight when tutorial deactivates (deferred to avoid sync setState in effect)
  useEffect(() => {
    if (state.active) return;
    const raf = requestAnimationFrame(() => { setSpotRect(null); setReady(false); });
    return () => cancelAnimationFrame(raf);
  }, [state.active]);

  // Measure and position spotlight when step changes
  useEffect(() => {
    if (!state.active) return;

    const stepChanged = prevStep.current !== state.step;
    prevStep.current = state.step;

    const t1 = setTimeout(() => {
      setReady(false);
      if (isOverlay) {
        setSpotRect(null);
        setTimeout(() => setReady(true), 0);
        return;
      }
      const res = measure();
      if (res?.el && stepChanged) {
        res.el.scrollIntoView({ behavior: shouldReduce ? "auto" : "smooth", block: "center" });
        const t2 = setTimeout(() => { measure(); setReady(true); }, shouldReduce ? 0 : 360);
        return () => clearTimeout(t2);
      } else {
        setReady(true);
      }
    }, 80);

    return () => clearTimeout(t1);
  }, [state.active, state.step, isOverlay, measure, shouldReduce]);

  useEffect(() => {
    if (!state.active) return;
    const fn = () => { if (!isOverlay) measure(); };
    window.addEventListener("resize", fn, { passive: true });
    return () => window.removeEventListener("resize", fn);
  }, [state.active, isOverlay, measure]);

  if (!state.active || !currentStep) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 390;
  const vh = typeof window !== "undefined" ? window.innerHeight : 844;
  const tw = Math.min(TOOLTIP_W, vw - MARGIN * 2);

  const pl = spotRect ? getPlacement(spotRect, vw, vh) : "center";
  const { x: tx, y: ty } = spotRect
    ? tooltipXY(spotRect, pl, vw, vh)
    : { x: vw / 2 - tw / 2, y: vh * 0.32 };

  const tooltipInitial = {
    opacity: 0,
    scale: 0.96,
    y: pl === "above" ? 6 : -6,
  };

  return (
    <AnimatePresence>
      {state.active && (
        <div
          key="tutorial-root"
          className="fixed inset-0 z-[250]"
          role="dialog"
          aria-modal
          aria-label="Tutorial de Financial OS"
        >
          {/* Clickable backdrop */}
          <motion.div
            className="absolute inset-0 cursor-pointer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduce ? 0 : 0.24, ease: EASE }}
            onClick={skip}
          />

          {/* SVG cutout overlay — spotlight on the target */}
          {spotRect ? (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <mask id="fin-tutorial-mask">
                  <rect width="100%" height="100%" fill="white" />
                  <rect
                    x={spotRect.x}
                    y={spotRect.y}
                    width={spotRect.w}
                    height={spotRect.h}
                    rx={SPOTLIGHT_R}
                    fill="black"
                    style={{
                      transition: shouldReduce
                        ? "none"
                        : "all 0.42s cubic-bezier(0.22,1,0.36,1)",
                    }}
                  />
                </mask>
              </defs>
              {/* Dim overlay with hole */}
              <rect
                width="100%"
                height="100%"
                fill="rgba(0,0,0,0.74)"
                mask="url(#fin-tutorial-mask)"
              />
              {/* Teal glow ring around the spotlight */}
              <rect
                x={spotRect.x - 1.5}
                y={spotRect.y - 1.5}
                width={spotRect.w + 3}
                height={spotRect.h + 3}
                rx={SPOTLIGHT_R + 2}
                fill="none"
                stroke="rgba(45,212,191,0.55)"
                strokeWidth="1.5"
                style={{
                  transition: shouldReduce
                    ? "none"
                    : "all 0.42s cubic-bezier(0.22,1,0.36,1)",
                }}
              />
            </svg>
          ) : (
            /* Solid overlay for non-spotlight steps */
            <div className="absolute inset-0 bg-black/76" />
          )}

          {/* Tooltip card */}
          <motion.div
            className="pointer-events-auto absolute"
            style={{ left: tx, top: ty, width: tw }}
            initial={tooltipInitial}
            animate={ready ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.96, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: shouldReduce ? 0 : 0.28, ease: EASE, delay: shouldReduce ? 0 : 0.06 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="overflow-hidden rounded-[18px] border border-white/[0.16]"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.036) 100%), hsl(222 22% 10% / 0.95)",
                boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
              }}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-3 px-5 pt-5">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-400">
                    Paso {state.step + 1} de {total}
                  </p>
                  <h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-white">
                    {currentStep.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={skip}
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.06] text-zinc-500 transition hover:bg-white/[0.12] hover:text-zinc-200"
                  aria-label="Saltar tutorial"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              {/* Description */}
              <p className="px-5 pb-4 pt-2 text-[13px] leading-[1.55] text-zinc-400">
                {currentStep.description}
              </p>

              {/* Footer — step dots + navigation */}
              <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] px-4 py-3">
                {/* Step indicators */}
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: total }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "rounded-full transition-all duration-300",
                        i === state.step
                          ? "h-[5px] w-[18px] bg-teal-400"
                          : i < state.step
                            ? "h-[5px] w-[5px] bg-teal-400/40"
                            : "h-[5px] w-[5px] bg-white/[0.15]",
                      )}
                    />
                  ))}
                </div>

                {/* Nav buttons */}
                <div className="flex items-center gap-1.5">
                  {!isFirst && (
                    <button
                      type="button"
                      onClick={back}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.05] text-zinc-400 transition hover:bg-white/[0.10] hover:text-white"
                      aria-label="Paso anterior"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={next}
                    className={cn(
                      "flex h-8 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition",
                      isLast
                        ? "bg-teal-400 text-zinc-950 shadow-[0_8px_24px_rgba(45,212,191,0.28)] hover:bg-teal-300"
                        : "border border-white/[0.15] bg-white/[0.07] text-white hover:bg-white/[0.13]",
                    )}
                    aria-label={isLast ? "Finalizar tutorial" : "Siguiente paso"}
                  >
                    {isLast ? "¡Listo!" : "Siguiente"}
                    {!isLast && <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
