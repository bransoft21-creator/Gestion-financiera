"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MeridianMarkProps = {
  /** Pixel size of the SVG mark (viewBox is 36×36). Default: 20 */
  size?: number;
  /** Wrap the mark in a rounded dark container with teal glow. Default: false */
  showContainer?: boolean;
  /** Container size in px. Defaults to size × 1.8 */
  containerSize?: number;
  /** Extra classes applied to the container div (requires showContainer=true) */
  containerClassName?: string;
  /** Render "meridian" wordmark text beside the mark. Default: false */
  showWordmark?: boolean;
  /** Extra classes applied to the wordmark <span> */
  wordmarkClassName?: string;
  /** Slow breathing pulse on the teal node. Respects prefers-reduced-motion. Default: false */
  animated?: boolean;
  /** Extra classes applied to the root wrapper */
  className?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MeridianMark({
  size = 20,
  showContainer = false,
  containerSize,
  containerClassName,
  showWordmark = false,
  wordmarkClassName,
  animated = false,
  className,
}: MeridianMarkProps) {
  const shouldReduceMotion = useReducedMotion();
  const shouldAnimate = animated && !shouldReduceMotion;
  const dim = containerSize ?? Math.round(size * 1.8);

  // ── SVG mark ────────────────────────────────────────────────────────────
  //
  // ViewBox 36×36:
  //   • Two 1px horizontal lines at y=13 and y=23 (10px apart, centered)
  //   • Soft glow circle at center (18,18)
  //   • Teal node circle at center (18,18), r=2.5
  //
  const svgMark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Glow halo */}
      {shouldAnimate ? (
        <motion.circle
          cx="18"
          cy="18"
          r="5"
          fill="#14B8A6"
          animate={{ opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : (
        <circle cx="18" cy="18" r="5" fill="#14B8A6" opacity="0.18" />
      )}

      {/* Top line */}
      <path
        d="M7 13 L29 13"
        stroke="white"
        strokeOpacity="0.22"
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* Bottom line */}
      <path
        d="M7 23 L29 23"
        stroke="white"
        strokeOpacity="0.22"
        strokeWidth="1"
        strokeLinecap="round"
      />

      {/* Teal node */}
      {shouldAnimate ? (
        <motion.circle
          cx="18"
          cy="18"
          r="2.5"
          fill="#14B8A6"
          animate={{ opacity: [1, 0.65, 1] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : (
        <circle cx="18" cy="18" r="2.5" fill="#14B8A6" />
      )}
    </svg>
  );

  // ── Container (optional) ─────────────────────────────────────────────────
  const mark = showContainer ? (
    <div
      style={{ width: dim, height: dim }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/60 shadow-[0_10px_34px_rgba(45,212,191,0.12)]",
        containerClassName,
      )}
    >
      {svgMark}
    </div>
  ) : (
    svgMark
  );

  // ── Wordmark (optional) ──────────────────────────────────────────────────
  if (!showWordmark) {
    return (
      <div className={cn("inline-flex shrink-0 items-center", className)}>
        {mark}
      </div>
    );
  }

  return (
    <div className={cn("inline-flex shrink-0 items-center gap-3", className)}>
      {mark}
      <span
        className={cn(
          "text-[13px] font-bold leading-tight tracking-tight text-foreground",
          wordmarkClassName,
        )}
      >
        meridian
      </span>
    </div>
  );
}
