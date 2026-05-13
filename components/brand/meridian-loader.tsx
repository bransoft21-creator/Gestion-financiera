"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type MeridianLoaderProps = {
  /** Mark size in px. Default: 28 */
  size?: number;
  /** Optional label rendered below the mark */
  label?: string;
  /** When true, fills the viewport with a dark overlay */
  fullScreen?: boolean;
  className?: string;
};

export function MeridianLoader({
  size = 28,
  label,
  fullScreen = false,
  className,
}: MeridianLoaderProps) {
  const shouldReduceMotion = useReducedMotion();

  const inner = (
    <motion.div
      className="flex flex-col items-center gap-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.45, ease: "easeOut" }}
    >
      <motion.div
        animate={shouldReduceMotion ? {} : { opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image
          src="/icons/Meridian.png"
          alt="Meridian"
          width={size}
          height={size}
          className="select-none"
          priority
        />
      </motion.div>
      {label && (
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      )}
    </motion.div>
  );

  if (fullScreen) {
    return (
      <div
        role="status"
        aria-label={label ?? "Cargando"}
        aria-live="polite"
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-background",
          className,
        )}
      >
        {inner}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={label ?? "Cargando"}
      aria-live="polite"
      className={cn("flex flex-col items-center gap-3", className)}
    >
      {inner}
    </div>
  );
}
