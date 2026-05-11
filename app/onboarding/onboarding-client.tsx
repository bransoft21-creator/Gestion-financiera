"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Check,
  CircleDollarSign,
  CreditCard,
  FileSpreadsheet,
  ScanLine,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ActionButton } from "@/components/ui-v2/action-button";

/* ── Goals ───────────────────────────────────────────────────────────────── */

const GOALS = [
  { id: "expenses", label: "Entender mis gastos", icon: BarChart3 },
  { id: "save", label: "Ahorrar más", icon: TrendingDown },
  { id: "debts", label: "Organizar deudas", icon: CreditCard },
  { id: "control", label: "Control mensual", icon: Wallet },
  { id: "excel", label: "Dejar el Excel", icon: FileSpreadsheet },
  { id: "auto", label: "Automatizar el seguimiento", icon: Brain },
];

/* ── Motion ──────────────────────────────────────────────────────────────── */

const easeOut = [0.16, 1, 0.3, 1] as const;

const stepVariants = {
  hidden: { opacity: 0, y: 20, filter: "blur(8px)" },
  visible: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.52, ease: easeOut },
  },
  exit: {
    opacity: 0, y: -10, filter: "blur(4px)",
    transition: { duration: 0.22, ease: "easeIn" as const },
  },
};

/* ── Main component ──────────────────────────────────────────────────────── */

type Step = 0 | 1 | 2;

export function OnboardingClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());
  const [isCompleting, setIsCompleting] = useState(false);

  function toggleGoal(id: string) {
    setSelectedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function completeOnboarding(redirectPath: string) {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
    } finally {
      router.push(redirectPath);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-5 py-16">

      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-48 -top-48 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(45,212,191,.09)_0%,transparent_65%)]" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,.06)_0%,transparent_65%)]" />
      </div>

      {/* Step indicator */}
      {step > 0 && (
        <div
          className="absolute top-8 left-0 right-0 flex justify-center gap-1.5"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={2}
          aria-label={`Paso ${step} de 2`}
        >
          {[1, 2].map((dot) => (
            <span
              key={dot}
              className={cn(
                "h-[3px] rounded-full transition-all duration-400",
                step >= dot ? "w-7 bg-white/50" : "w-2 bg-white/12",
              )}
            />
          ))}
        </div>
      )}

      {/* Steps */}
      <div className="relative z-10 w-full max-w-[360px]">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step-0" variants={stepVariants} initial="hidden" animate="visible" exit="exit">
              <WelcomeStep onNext={() => setStep(1)} />
            </motion.div>
          )}
          {step === 1 && (
            <motion.div key="step-1" variants={stepVariants} initial="hidden" animate="visible" exit="exit">
              <GoalsStep
                selectedGoals={selectedGoals}
                onToggle={toggleGoal}
                onNext={() => setStep(2)}
              />
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="step-2" variants={stepVariants} initial="hidden" animate="visible" exit="exit">
              <StartStep isCompleting={isCompleting} onSelect={completeOnboarding} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Step 0 — Welcome ────────────────────────────────────────────────────── */

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      <motion.p
        className="mb-10 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-700"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.1, duration: 0.6 } }}
      >
        Financial OS
      </motion.p>

      <motion.h1
        className="text-balance text-[44px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[52px]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.18, duration: 0.55, ease: [0.16, 1, 0.3, 1] } }}
      >
        Tu dinero,{" "}
        <span className="text-zinc-500">con perspectiva.</span>
      </motion.h1>

      <motion.p
        className="mx-auto mt-6 max-w-[280px] text-[15px] leading-relaxed text-zinc-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.32, duration: 0.5 } }}
      >
        Entendé en qué punto estás y hacia dónde vas. Una sola vista para todo.
      </motion.p>

      <motion.div
        className="mt-10"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.44, duration: 0.45, ease: [0.16, 1, 0.3, 1] } }}
      >
        <ActionButton size="lg" className="min-w-[160px]" onClick={onNext}>
          Empezar
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </ActionButton>
      </motion.div>
    </div>
  );
}

/* ── Step 1 — Goals ──────────────────────────────────────────────────────── */

function GoalsStep({
  selectedGoals,
  onToggle,
  onNext,
}: {
  selectedGoals: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 className="text-balance text-[26px] font-semibold leading-tight text-white">
        ¿Qué querés mejorar?
      </h2>
      <p className="mt-2.5 text-sm text-zinc-500">
        Elegí todo lo que aplique.
      </p>

      <div className="mt-7 flex flex-wrap gap-2">
        {GOALS.map((goal) => {
          const isSelected = selectedGoals.has(goal.id);
          return (
            <button
              key={goal.id}
              type="button"
              onClick={() => onToggle(goal.id)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition duration-150",
                isSelected
                  ? "border-white/20 bg-white/[0.09] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.07)]"
                  : "border-white/[0.07] bg-white/[0.025] text-zinc-500 hover:border-white/12 hover:bg-white/[0.05] hover:text-zinc-300",
              )}
              aria-pressed={isSelected}
            >
              {isSelected && (
                <Check className="h-3 w-3 shrink-0 text-teal-300" aria-hidden="true" />
              )}
              {goal.label}
            </button>
          );
        })}
      </div>

      <div className="mt-9 flex items-center gap-4">
        <ActionButton size="lg" className="flex-1" onClick={onNext}>
          Continuar
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </ActionButton>
        <button
          type="button"
          onClick={onNext}
          className="text-sm text-zinc-700 transition hover:text-zinc-400"
        >
          Saltar
        </button>
      </div>
    </div>
  );
}

/* ── Step 2 — Start ──────────────────────────────────────────────────────── */

const START_OPTIONS = [
  {
    id: "import",
    path: "/smart-import",
    icon: ScanLine,
    label: "Smart Import",
    description: "Subí un resumen, screenshot o PDF. La IA extrae los datos sola.",
    featured: true,
  },
  {
    id: "manual",
    path: "/transactions?new=1",
    icon: CircleDollarSign,
    label: "Primer movimiento",
    description: "Cargá tu primer ingreso o gasto ahora mismo.",
    featured: false,
  },
  {
    id: "explore",
    path: "/dashboard",
    icon: BarChart3,
    label: "Solo explorar",
    description: "Mirá cómo funciona antes de cargar nada.",
    featured: false,
  },
] as const;

function StartStep({
  isCompleting,
  onSelect,
}: {
  isCompleting: boolean;
  onSelect: (path: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  function handleSelect(path: string) {
    if (isCompleting) return;
    setSelected(path);
    onSelect(path);
  }

  return (
    <div>
      <h2 className="text-balance text-[26px] font-semibold leading-tight text-white">
        ¿Cómo querés empezar?
      </h2>
      <p className="mt-2.5 text-sm text-zinc-500">Podés cambiar en cualquier momento.</p>

      <div className="mt-7 space-y-2.5">
        {START_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isLoading = selected === option.path && isCompleting;
          const isDisabled = isCompleting && selected !== option.path;

          return (
            <button
              key={option.id}
              type="button"
              disabled={isCompleting}
              onClick={() => handleSelect(option.path)}
              className={cn(
                "group w-full rounded-2xl border p-4 text-left transition duration-150",
                option.featured
                  ? "border-teal-300/20 bg-teal-300/[0.05] hover:border-teal-300/30 hover:bg-teal-300/[0.09]"
                  : "border-white/[0.07] bg-white/[0.025] hover:border-white/[0.13] hover:bg-white/[0.045]",
                isDisabled && "opacity-40",
              )}
            >
              <div className="flex items-center gap-3.5">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  option.featured
                    ? "bg-teal-300/15 text-teal-100"
                    : "bg-white/[0.06] text-zinc-400 group-hover:text-zinc-200",
                )}>
                  {isLoading ? (
                    <div
                      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden="true"
                    />
                  ) : (
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    "text-sm font-semibold",
                    option.featured ? "text-teal-50" : "text-zinc-100",
                  )}>
                    {option.label}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-zinc-600">{option.description}</p>
                </div>
                <ArrowRight
                  className={cn(
                    "h-4 w-4 shrink-0 transition",
                    option.featured
                      ? "text-teal-400/40 group-hover:text-teal-400/70"
                      : "text-zinc-800 group-hover:text-zinc-500",
                  )}
                  aria-hidden="true"
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
