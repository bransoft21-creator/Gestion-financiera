"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CircleDollarSign,
  ScanLine,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { trackProductEvent } from "@/lib/observability/client";
import { ActionButton } from "@/components/ui-v2/action-button";

/* ── Goals ───────────────────────────────────────────────────────────────── */

const GOALS = [
  { id: "expenses", label: "Entender mis gastos" },
  { id: "save", label: "Ahorrar más" },
  { id: "debts", label: "Organizar deudas" },
  { id: "control", label: "Control mensual" },
  { id: "excel", label: "Dejar el Excel" },
  { id: "auto", label: "Automatizar el seguimiento" },
];

/* ── Start options (dynamic — respects feature flags) ────────────────────── */

type StartOption = {
  id: string;
  path: string;
  icon: typeof ScanLine;
  label: string;
  description: string;
  featured: boolean;
};

function buildStartOptions(canSmartImport: boolean): StartOption[] {
  return [
    ...(canSmartImport
      ? [
          {
            id: "import",
            path: "/smart-import",
            icon: ScanLine,
            label: "Smart Import",
            description: "Subí un resumen, screenshot o PDF. La IA extrae los datos sola.",
            featured: true,
          },
        ]
      : []),
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
  ];
}

/* ── Motion ──────────────────────────────────────────────────────────────── */

const easeOut = [0.16, 1, 0.3, 1] as const;

const stepVariants = {
  hidden: { opacity: 0, y: 20, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.52, ease: easeOut },
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: "blur(4px)",
    transition: { duration: 0.22, ease: "easeIn" as const },
  },
};

/* ── Main component ──────────────────────────────────────────────────────── */

type Step = 0 | 1 | 2;

export function OnboardingClient({
  canSmartImport,
  replayMode = false,
}: {
  canSmartImport: boolean;
  replayMode?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const startOptions = buildStartOptions(canSmartImport);

  useEffect(() => {
    trackProductEvent("onboarding_started", { replayMode }, "onboarding");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleGoal(id: string) {
    setSelectedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function advanceFromGoals() {
    trackProductEvent("onboarding_goals_advanced", { goalCount: selectedGoals.size }, "onboarding");
    setStep(2);
  }

  const START_OPTION_MAP: Record<string, string> = {
    "/smart-import": "import",
    "/transactions?new=1": "manual",
    "/dashboard": "explore",
  };

  async function completeOnboarding(path: string) {
    if (pendingPath) return;
    setPendingPath(path);
    trackProductEvent("onboarding_completed", { startOption: START_OPTION_MAP[path] ?? "unknown" }, "onboarding");

    // En replay no llamamos a la API — el onboarding ya está completado
    if (replayMode) {
      router.push(path);
      return;
    }

    try {
      const res = await fetch("/api/onboarding/complete", { method: "POST" });
      if (res.ok) {
        router.push(path);
        // Don't reset pendingPath — component will unmount on navigation
      } else if (res.status === 401) {
        router.push("/login");
      } else {
        setPendingPath(null);
      }
    } catch {
      setPendingPath(null);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-5 py-16">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-48 -top-48 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(45,212,191,.09)_0%,transparent_65%)]" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(251,191,36,.06)_0%,transparent_65%)]" />
      </div>

      {/* Botón Volver — solo en modo replay */}
      {replayMode && (
        <button
          type="button"
          onClick={() => router.push("/profile")}
          className="absolute left-5 top-8 flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver
        </button>
      )}

      {/* Step indicator — shown from step 1 */}
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
                "h-[3px] rounded-full transition-all duration-300",
                step >= dot ? "w-7 bg-white/50" : "w-2 bg-white/12",
              )}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 w-full max-w-[360px]">
        <AnimatePresence mode="wait">
          {step === 0 && (
            // initial={false}: WelcomeStep owns its entrance via inner motion elements;
            // parent only provides the exit animation
            <motion.div key="step-0" variants={stepVariants} initial={false} animate="visible" exit="exit">
              <WelcomeStep onNext={() => setStep(1)} />
            </motion.div>
          )}
          {step === 1 && (
            <motion.div key="step-1" variants={stepVariants} initial="hidden" animate="visible" exit="exit">
              <GoalsStep
                selectedGoals={selectedGoals}
                onToggle={toggleGoal}
                onNext={advanceFromGoals}
              />
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="step-2" variants={stepVariants} initial="hidden" animate="visible" exit="exit">
              <StartStep
                options={startOptions}
                pendingPath={pendingPath}
                onSelect={completeOnboarding}
              />
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
      {/* Logo — appears first, sets the brand tone before any text */}
      <motion.div
        className="mb-8 flex justify-center"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1, transition: { delay: 0.04, duration: 0.55, ease: easeOut } }}
      >
        <Image src="/icons/Meridian.png" alt="Meridian" width={72} height={72} className="select-none" priority />
      </motion.div>

      <motion.p
        className="mb-8 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.18, duration: 0.55 } }}
      >
        Meridian
      </motion.p>

      <motion.h1
        className="text-balance text-[40px] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[48px]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.26, duration: 0.55, ease: easeOut } }}
      >
        Tu dinero,{" "}
        <span className="text-muted-foreground">con perspectiva.</span>
      </motion.h1>

      <motion.p
        className="mx-auto mt-5 max-w-[280px] text-[15px] leading-relaxed text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.36, duration: 0.5 } }}
      >
        Entendé en qué punto estás y hacia dónde vas. Una sola vista para todo.
      </motion.p>

      <motion.div
        className="mt-10"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.46, duration: 0.45, ease: easeOut } }}
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
      <h2 className="text-balance text-[26px] font-semibold leading-tight text-foreground">
        ¿Qué querés mejorar?
      </h2>
      <p className="mt-2.5 text-sm text-muted-foreground">Elegí todo lo que aplique.</p>

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
                  ? "border-border bg-muted/70 text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.07)]"
                  : "border-border bg-muted/20 text-muted-foreground hover:border-white/12 hover:bg-muted/40 hover:text-muted-foreground",
              )}
              aria-pressed={isSelected}
            >
              {isSelected && <Check className="h-3 w-3 shrink-0 text-teal-300" aria-hidden="true" />}
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
          className="text-sm text-muted-foreground transition hover:text-muted-foreground"
        >
          Saltar
        </button>
      </div>
    </div>
  );
}

/* ── Step 2 — Start ──────────────────────────────────────────────────────── */

function StartStep({
  options,
  pendingPath,
  onSelect,
}: {
  options: ReturnType<typeof buildStartOptions>;
  pendingPath: string | null;
  onSelect: (path: string) => void;
}) {
  return (
    <div>
      <h2 className="text-balance text-[26px] font-semibold leading-tight text-foreground">
        ¿Cómo querés empezar?
      </h2>
      <p className="mt-2.5 text-sm text-muted-foreground">Podés cambiar en cualquier momento.</p>

      <div className="mt-7 space-y-2.5">
        {options.map((option) => {
          const Icon = option.icon;
          const isLoading = pendingPath === option.path;
          const isDisabled = pendingPath !== null;

          return (
            <button
              key={option.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(option.path)}
              className={cn(
                "group w-full rounded-2xl border p-4 text-left transition duration-150",
                option.featured
                  ? "border-teal-300/20 bg-teal-300/[0.05] hover:border-teal-300/30 hover:bg-teal-300/[0.09]"
                  : "border-border bg-muted/20 hover:border-border hover:bg-muted/40",
                isDisabled && !isLoading && "opacity-40",
              )}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    option.featured
                      ? "bg-teal-300/15 text-primary"
                      : "bg-muted/50 text-muted-foreground group-hover:text-muted-foreground",
                  )}
                >
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
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      option.featured ? "text-teal-50" : "text-foreground",
                    )}
                  >
                    {option.label}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{option.description}</p>
                </div>
                <ArrowRight
                  className={cn(
                    "h-4 w-4 shrink-0 transition",
                    option.featured
                      ? "text-teal-400/40 group-hover:text-teal-400/70"
                      : "text-foreground group-hover:text-muted-foreground",
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
