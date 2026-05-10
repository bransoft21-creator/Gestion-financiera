"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flag,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { ActionButton } from "@/components/ui-v2/action-button";
import {
  PremiumCard,
  PremiumCardContent,
  PremiumCardDescription,
  PremiumCardHeader,
  PremiumCardTitle,
} from "@/components/ui-v2/premium-card";
import {
  AppFormPanel,
  MobileCreateFab,
  appFormActionsClass,
  appFormContentClass,
  appFormHeaderClass,
} from "@/components/app/mobile-form";
import { formatArgentinaDateInput } from "@/lib/dates";
import { moneySchema, optionalMoneySchema, parseMoneyInput } from "@/lib/money";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type GoalStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELED";
type CurrencyCode = "ARS" | "USD";
type AccountOption = { id: string; name: string; type: string; currency: CurrencyCode };

type GoalItem = {
  id: string;
  name: string;
  currency: CurrencyCode;
  targetAmount: number;
  currentAmount: number;
  requiredMonthlyAmount: number | null;
  targetDate: string | null;
  status: GoalStatus;
  notes: string | null;
};

type GoalsClientProps = {
  householdId: string;
  accounts: AccountOption[];
};

type FormState = {
  name: string;
  currency: CurrencyCode;
  targetAmount: string;
  currentAmount: string;
  requiredMonthlyAmount: string;
  targetDate: string;
  status: GoalStatus;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

type GoalSummary = {
  active: number;
  completed: number;
  paused: number;
  averageProgress: number;
  monthlyCommitments: Partial<Record<CurrencyCode, number>>;
  nextGoal: GoalItem | null;
};

const statusLabels: Record<GoalStatus, string> = {
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  COMPLETED: "Completada",
  CANCELED: "Cancelada",
};

const statuses = Object.keys(statusLabels) as GoalStatus[];

const goalSchema = z.object({
  name: z.string().trim().min(2, "Ingresá un nombre.").max(100),
  currency: z.enum(["ARS", "USD"]),
  targetAmount: moneySchema(),
  currentAmount: moneySchema({ allowZero: true }),
  requiredMonthlyAmount: optionalMoneySchema({ allowZero: true }),
  targetDate: z.string().optional(),
  status: z.enum(statuses),
  notes: z.string().trim().max(1000).optional(),
});

const defaultForm: FormState = {
  name: "",
  currency: "ARS",
  targetAmount: "",
  currentAmount: "0",
  requiredMonthlyAmount: "",
  targetDate: "",
  status: "ACTIVE",
  notes: "",
};

const cardMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
} as const;

export function GoalsClient({ householdId, accounts }: GoalsClientProps) {
  const defaultAccount = getPreferredArsBankAccount(accounts);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [pendingDeleteGoal, setPendingDeleteGoal] = useState<GoalItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [contributingGoalId, setContributingGoalId] = useState<string | null>(null);
  const [quickContribGoalId, setQuickContribGoalId] = useState<string | null>(null);
  const [quickContribAccountId, setQuickContribAccountId] = useState<string>("");
  const [quickContribAmount, setQuickContribAmount] = useState<string>("");
  const [quickContribErrors, setQuickContribErrors] = useState<{ accountId?: string; amount?: string }>({});

  const summary = useMemo(() => buildGoalSummary(goals), [goals]);

  useEffect(() => {
    void loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadGoals() {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/goals?${new URLSearchParams({ householdId }).toString()}`);
      const payload = (await response.json()) as { data?: GoalItem[]; error?: string };

      if (!response.ok) {
        toast.error(payload.error ?? "No se pudieron cargar las metas.");
        return;
      }

      setGoals(payload.data ?? []);
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const parsed = goalSchema.safeParse(form);

    if (!parsed.success) {
      const nextErrors: FormErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string") {
          nextErrors[field as keyof FormState] = issue.message;
        }
      });
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      const response = await fetch(editingGoalId ? `/api/goals/${editingGoalId}` : "/api/goals", {
        method: editingGoalId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId,
          name: parsed.data.name,
          currency: parsed.data.currency,
          targetAmount: parsed.data.targetAmount,
          currentAmount: parsed.data.currentAmount,
          requiredMonthlyAmount: parsed.data.requiredMonthlyAmount ?? (editingGoalId ? null : undefined),
          targetDate: parsed.data.targetDate || (editingGoalId ? null : undefined),
          status: parsed.data.status,
          notes: parsed.data.notes || (editingGoalId ? null : undefined),
        }),
      });
      const payload = (await response.json()) as { error?: string; fieldErrors?: FormErrors };

      if (!response.ok) {
        if (payload.fieldErrors) setErrors(payload.fieldErrors);
        setMessage(payload.error ?? "No se pudo guardar la meta.");
        return;
      }

      toast.success(editingGoalId ? "Meta actualizada." : "Meta creada.");
      resetForm();
      setIsFormOpen(false);
      await loadGoals();
    } catch {
      setMessage("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  function requestDelete(goal: GoalItem) {
    setPendingDeleteGoal(goal);
  }

  async function confirmDelete() {
    if (!pendingDeleteGoal) return;

    const goalId = pendingDeleteGoal.id;
    setDeletingGoalId(goalId);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/goals/${goalId}?${new URLSearchParams({ householdId }).toString()}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(payload.error ?? "No se pudo eliminar la meta.");
        return;
      }

      toast.success("Meta eliminada.");
      setPendingDeleteGoal(null);
      if (editingGoalId === goalId) {
        resetForm();
        setIsFormOpen(false);
      }

      await loadGoals();
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setDeletingGoalId(null);
    }
  }

  function openContribution(goal: GoalItem) {
    setQuickContribGoalId(goal.id);
    setQuickContribAccountId(defaultAccount?.id ?? "");
    setQuickContribAmount(goal.requiredMonthlyAmount != null ? String(goal.requiredMonthlyAmount) : "");
    setQuickContribErrors({});
  }

  function cancelContribution() {
    setQuickContribGoalId(null);
    setQuickContribAccountId("");
    setQuickContribAmount("");
    setQuickContribErrors({});
  }

  async function handleContribConfirm(goal: GoalItem) {
    if (!quickContribAccountId) {
      setQuickContribErrors({ accountId: "Seleccioná una cuenta para el aporte." });
      return;
    }
    const parsedAmount = parseMoneyInput(quickContribAmount);
    if (!parsedAmount.success || parsedAmount.data == null) {
      setQuickContribErrors({ amount: parsedAmount.success ? "Ingresá un monto." : parsedAmount.error });
      return;
    }
    const remaining = goal.targetAmount - goal.currentAmount;
    if (parsedAmount.data > remaining && remaining > 0) {
      setQuickContribErrors({ amount: `El aporte supera el saldo restante (${formatMoney(remaining, goal.currency)}).` });
      return;
    }

    setQuickContribErrors({});
    setContributingGoalId(goal.id);
    try {
      const today = formatArgentinaDateInput();
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId,
          type: "GOAL_CONTRIBUTION",
          status: "CONFIRMED",
          accountId: quickContribAccountId,
          goalId: goal.id,
          amount: parsedAmount.data,
          currency: goal.currency,
          description: `Aporte: ${goal.name}`,
          occurredAt: today,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "No se pudo registrar el aporte.");
        return;
      }

      toast.success(`Aporte a "${goal.name}" registrado correctamente.`);
      cancelContribution();
      await loadGoals();
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setContributingGoalId(null);
    }
  }

  function startEditing(goal: GoalItem) {
    setEditingGoalId(goal.id);
    setErrors({});
    setMessage(null);
    setForm({
      name: goal.name,
      currency: goal.currency,
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      requiredMonthlyAmount: goal.requiredMonthlyAmount != null ? String(goal.requiredMonthlyAmount) : "",
      targetDate: goal.targetDate ? goal.targetDate.slice(0, 10) : "",
      status: goal.status,
      notes: goal.notes ?? "",
    });
    setIsFormOpen(true);
  }

  function resetForm() {
    setEditingGoalId(null);
    setErrors({});
    setForm(defaultForm);
  }

  function updateForm<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openNewGoal() {
    resetForm();
    setIsFormOpen(true);
  }

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <AppFormPanel
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          className="border-white/10 bg-zinc-950/80 shadow-[0_24px_80px_rgba(0,0,0,0.32)] xl:rounded-[var(--v2-radius-xl)]"
        >
          <div className={appFormHeaderClass("border-white/10 bg-zinc-950/95 xl:bg-transparent")}>
            <div className="flex items-start gap-3 p-5 sm:p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white">
                <Flag className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-tight text-white">
                  {editingGoalId ? "Ajustar hito" : "Nuevo hito"}
                </h2>
                <p className="mt-1 text-sm leading-5 text-zinc-400">Objetivo, ritmo y fecha esperada.</p>
              </div>
              <ActionButton
                type="button"
                variant="quiet"
                size="icon"
                aria-label="Cerrar formulario"
                className="ml-auto xl:hidden"
                onClick={() => setIsFormOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </ActionButton>
            </div>
          </div>
          <div className={appFormContentClass(isFormOpen, "px-5 sm:px-6")}>
            <form className="space-y-4 pb-5" onSubmit={handleSubmit}>
              <Field label="Nombre" error={errors.name}>
                <Input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="Ej. Fondo de emergencia"
                  className="v2-focus-ring h-11 rounded-2xl border-white/10 bg-white/[0.05] text-white placeholder:text-zinc-600"
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-[104px_1fr]">
                <Field label="Moneda" error={errors.currency}>
                  <select
                    className="v2-focus-ring h-11 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none transition hover:bg-white/[0.07]"
                    value={form.currency}
                    onChange={(event) => updateForm("currency", event.target.value as CurrencyCode)}
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </Field>
                <Field label="Objetivo" error={errors.targetAmount}>
                  <Input
                    inputMode="decimal"
                    value={form.targetAmount}
                    onChange={(event) => updateForm("targetAmount", event.target.value)}
                    className="v2-focus-ring h-11 rounded-2xl border-white/10 bg-white/[0.05] text-white"
                  />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Actual" error={errors.currentAmount}>
                  <Input
                    inputMode="decimal"
                    value={form.currentAmount}
                    onChange={(event) => updateForm("currentAmount", event.target.value)}
                    className="v2-focus-ring h-11 rounded-2xl border-white/10 bg-white/[0.05] text-white"
                  />
                </Field>
                <Field label="Aporte mensual" error={errors.requiredMonthlyAmount}>
                  <Input
                    inputMode="decimal"
                    value={form.requiredMonthlyAmount}
                    onChange={(event) => updateForm("requiredMonthlyAmount", event.target.value)}
                    className="v2-focus-ring h-11 rounded-2xl border-white/10 bg-white/[0.05] text-white"
                  />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Fecha objetivo" error={errors.targetDate}>
                  <Input
                    type="date"
                    value={form.targetDate}
                    onChange={(event) => updateForm("targetDate", event.target.value)}
                    className="v2-focus-ring h-11 rounded-2xl border-white/10 bg-white/[0.05] text-white"
                  />
                </Field>
                <Field label="Estado" error={errors.status}>
                  <select
                    className="v2-focus-ring h-11 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none transition hover:bg-white/[0.07]"
                    value={form.status}
                    onChange={(event) => updateForm("status", event.target.value as GoalStatus)}
                  >
                    {(editingGoalId ? statuses : statuses.filter((status) => status !== "CANCELED")).map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Notas" error={errors.notes}>
                <textarea
                  className="v2-focus-ring min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600"
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder="Qué significa este hito para vos..."
                />
              </Field>

              {message ? (
                <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">
                  {message}
                </p>
              ) : null}

              <div className={appFormActionsClass("xl:grid-cols-1 2xl:grid-cols-2")}>
                <ActionButton className="w-full" disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  {editingGoalId ? "Guardar cambios" : "Crear hito"}
                </ActionButton>
                {editingGoalId ? (
                  <ActionButton
                    type="button"
                    variant="glass"
                    className="w-full"
                    onClick={() => {
                      resetForm();
                      setIsFormOpen(false);
                    }}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Cancelar
                  </ActionButton>
                ) : null}
              </div>
            </form>
          </div>
        </AppFormPanel>

        <div className="space-y-5">
          <GoalsBriefing summary={summary} goalCount={goals.length} isLoading={isLoading} onCreate={openNewGoal} />

          <PremiumCard variant="default" className="overflow-hidden">
            <PremiumCardHeader className="pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <PremiumCardTitle>Hitos en movimiento</PremiumCardTitle>
                  <PremiumCardDescription>
                    {goals.length} metas entre activas, pausadas e históricas.
                  </PremiumCardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="w-fit border-emerald-300/20 bg-emerald-300/10 text-emerald-100">
                    {summary.active} activas
                  </Badge>
                  <ActionButton type="button" size="sm" className="hidden xl:inline-flex" onClick={openNewGoal}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Nuevo
                  </ActionButton>
                </div>
              </div>
            </PremiumCardHeader>
            <PremiumCardContent>
              {isLoading ? (
                <GoalSkeletonList />
              ) : goals.length === 0 ? (
                <GoalEmptyState onCreate={openNewGoal} />
              ) : (
                <div className="grid gap-3">
                  <AnimatePresence initial={false}>
                    {goals.map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        accounts={accounts}
                        isDeleting={deletingGoalId === goal.id}
                        isContributing={contributingGoalId === goal.id}
                        isContribOpen={quickContribGoalId === goal.id}
                        quickContribAccountId={quickContribAccountId}
                        quickContribAmount={quickContribAmount}
                        quickContribErrors={quickContribErrors}
                        onEdit={startEditing}
                        onDelete={requestDelete}
                        onContribOpen={() => openContribution(goal)}
                        onContribCancel={cancelContribution}
                        onContribAccountChange={setQuickContribAccountId}
                        onContribAmountChange={setQuickContribAmount}
                        onContribConfirm={() => handleContribConfirm(goal)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </PremiumCardContent>
          </PremiumCard>
        </div>
        <MobileCreateFab label="Nueva meta" onClick={openNewGoal} />
      </div>

      <DeleteGoalDialog
        goal={pendingDeleteGoal}
        isDeleting={deletingGoalId === pendingDeleteGoal?.id}
        onCancel={() => setPendingDeleteGoal(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function GoalsBriefing({
  summary,
  goalCount,
  isLoading,
  onCreate,
}: {
  summary: GoalSummary;
  goalCount: number;
  isLoading: boolean;
  onCreate: () => void;
}) {
  const state = getGoalState(summary, goalCount);
  const monthlyText = formatCommitments(summary.monthlyCommitments);

  return (
    <motion.div {...cardMotion}>
      <PremiumCard variant="raised" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_18%_0%,rgba(52,211,153,0.18),transparent_36%),radial-gradient(circle_at_82%_0%,rgba(96,165,250,0.14),transparent_34%)]" />
        <PremiumCardContent className="relative p-5 sm:p-6">
          {isLoading ? (
            <div className="space-y-5">
              <Skeleton className="h-5 w-36 rounded-full bg-white/10" />
              <Skeleton className="h-8 w-80 max-w-full rounded-full bg-white/10" />
              <Skeleton className="h-3 w-full rounded-full bg-white/10" />
              <div className="grid gap-3 sm:grid-cols-3">
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-20 rounded-3xl bg-white/10" />
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-zinc-300">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-200" aria-hidden="true" />
                    Momentum financiero
                  </div>
                  <h2 className="text-balance text-2xl font-semibold leading-tight text-white sm:text-3xl">
                    {state.title}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">{state.description}</p>
                </div>

                <div className="flex items-center gap-3 lg:flex-col lg:items-end">
                  <CircularProgress value={summary.averageProgress} size={96} strokeWidth={7} />
                  <ActionButton type="button" variant="glass" size="sm" onClick={onCreate}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Nuevo hito
                  </ActionButton>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <GoalBriefMetric icon={Target} label="Activas" value={`${summary.active}`} />
                <GoalBriefMetric icon={WalletCards} label="Aporte mensual" value={monthlyText} />
                <GoalBriefMetric
                  icon={CalendarDays}
                  label="Próximo hito"
                  value={summary.nextGoal?.targetDate ? formatDate(summary.nextGoal.targetDate) : "Sin fecha"}
                />
              </div>
            </>
          )}
        </PremiumCardContent>
      </PremiumCard>
    </motion.div>
  );
}

function GoalBriefMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-4">
      <Icon className="h-4 w-4 text-zinc-400" aria-hidden />
      <p className="mt-3 text-[11px] font-medium uppercase text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function getPreferredArsBankAccount(accounts: AccountOption[]) {
  return (
    accounts.find((account) => account.currency === "ARS" && account.type === "BANK" && account.name.toLowerCase() === "cuenta bancaria") ??
    accounts.find((account) => account.currency === "ARS" && account.type === "BANK") ??
    accounts.find((account) => account.currency === "ARS") ??
    accounts[0]
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase text-zinc-500">{label}</Label>
      {children}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

function CircularProgress({ value, size = 72, strokeWidth = 6 }: { value: number; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);
  const normalized = Math.min(Math.max(value, 0), 100);

  useEffect(() => {
    const timer = setTimeout(() => setOffset(circ - (normalized / 100) * circ), 120);
    return () => clearTimeout(timer);
  }, [normalized, circ]);

  const color = normalized >= 100 ? "#c4b5fd" : normalized >= 60 ? "#5eead4" : normalized >= 30 ? "#93c5fd" : "#fcd34d";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 12px ${color}55)`, transition: "stroke-dashoffset 0.85s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold tabular-nums text-white">{Math.round(value)}%</span>
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  accounts,
  isDeleting,
  isContributing,
  isContribOpen,
  quickContribAccountId,
  quickContribAmount,
  quickContribErrors,
  onEdit,
  onDelete,
  onContribOpen,
  onContribCancel,
  onContribAccountChange,
  onContribAmountChange,
  onContribConfirm,
}: {
  goal: GoalItem;
  accounts: AccountOption[];
  isDeleting: boolean;
  isContributing: boolean;
  isContribOpen: boolean;
  quickContribAccountId: string;
  quickContribAmount: string;
  quickContribErrors: { accountId?: string; amount?: string };
  onEdit: (goal: GoalItem) => void;
  onDelete: (goal: GoalItem) => void;
  onContribOpen: () => void;
  onContribCancel: () => void;
  onContribAccountChange: (value: string) => void;
  onContribAmountChange: (value: string) => void;
  onContribConfirm: () => void;
}) {
  const actualPct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
  const displayPct = Math.min(actualPct, 100);
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
  const impactsDashboard = goal.status === "ACTIVE" && goal.requiredMonthlyAmount != null;
  const canContribute = goal.status === "ACTIVE" && goal.currentAmount < goal.targetAmount && accounts.length > 0;

  return (
    <motion.article
      layout
      {...cardMotion}
      className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.035] p-4 transition duration-200 hover:border-white/[0.16] hover:bg-white/[0.055] sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-emerald-100">
            <Target className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-white">{goal.name}</p>
            <p className="mt-1 text-sm leading-5 text-zinc-400">
              {formatMoney(goal.currentAmount, goal.currency)} de {formatMoney(goal.targetAmount, goal.currency)}
            </p>
            {goal.targetDate ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300">
                <CalendarDays className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
                {formatDate(goal.targetDate)}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className={getStatusClass(goal.status)}>{statusLabels[goal.status]}</Badge>
              {goal.requiredMonthlyAmount ? (
                <Badge className="border-white/10 bg-white/[0.06] text-zinc-200">
                  {formatMoney(goal.requiredMonthlyAmount, goal.currency)} / mes
                </Badge>
              ) : null}
              {impactsDashboard ? (
                <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">impacta dashboard</Badge>
              ) : null}
            </div>
          </div>
        </div>
        <CircularProgress value={displayPct} size={72} strokeWidth={6} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <GoalMetric label="Actual" value={formatMoney(goal.currentAmount, goal.currency)} />
        <GoalMetric label="Falta" value={formatMoney(remaining, goal.currency)} />
        <GoalMetric label="Progreso" value={`${actualPct.toFixed(0)}%`} />
        <GoalMetric label="Estado" value={statusLabels[goal.status]} />
      </div>

      {goal.notes ? <p className="mt-4 rounded-2xl border border-white/[0.08] bg-black/15 p-3 text-sm leading-6 text-zinc-400">{goal.notes}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canContribute && (
          <ActionButton
            type="button"
            variant="glass"
            size="sm"
            disabled={isContributing}
            onClick={isContribOpen ? onContribCancel : onContribOpen}
          >
            {isContributing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-200" aria-hidden="true" />
            )}
            Hacer aporte
          </ActionButton>
        )}
        <ActionButton type="button" variant="glass" size="sm" onClick={() => onEdit(goal)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Editar
        </ActionButton>
        <ActionButton
          type="button"
          variant="danger"
          size="sm"
          disabled={isDeleting}
          onClick={() => onDelete(goal)}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          )}
          Eliminar
        </ActionButton>
      </div>

      <AnimatePresence initial={false}>
        {isContribOpen ? (
          <motion.div
            {...cardMotion}
            className="mt-4 space-y-3 rounded-[1.5rem] border border-emerald-300/20 bg-emerald-300/10 p-4"
          >
            <p className="text-xs font-semibold uppercase text-emerald-100">Registrar aporte</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Cuenta</label>
                <select
                  className="v2-focus-ring h-10 w-full rounded-2xl border border-white/10 bg-zinc-950/70 px-3 text-sm text-white outline-none"
                  value={quickContribAccountId}
                  onChange={(event) => onContribAccountChange(event.target.value)}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                {quickContribErrors.accountId ? <p className="text-xs text-rose-200">{quickContribErrors.accountId}</p> : null}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Monto ({goal.currency})</label>
                <Input
                  inputMode="decimal"
                  value={quickContribAmount}
                  onChange={(event) => onContribAmountChange(event.target.value)}
                  placeholder="0"
                  className="v2-focus-ring h-10 rounded-2xl border-white/10 bg-zinc-950/70 text-white placeholder:text-zinc-600"
                />
                {quickContribErrors.amount ? <p className="text-xs text-rose-200">{quickContribErrors.amount}</p> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton type="button" size="sm" disabled={isContributing} onClick={onContribConfirm}>
                {isContributing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                Confirmar
              </ActionButton>
              <ActionButton type="button" variant="quiet" size="sm" onClick={onContribCancel}>
                <X className="h-4 w-4" aria-hidden="true" />
                Cancelar
              </ActionButton>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}

function GoalMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-black/15 p-3">
      <p className="text-[10px] font-medium uppercase text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function GoalSkeletonList() {
  return (
    <div className="grid gap-3">
      {[1, 2].map((item) => (
        <div key={item} className="space-y-4 rounded-[1.75rem] border border-white/[0.08] bg-white/[0.035] p-4">
          <div className="flex gap-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-2xl bg-white/10" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40 bg-white/10" />
              <Skeleton className="h-3 w-56 max-w-full bg-white/10" />
            </div>
            <Skeleton className="h-16 w-16 shrink-0 rounded-full bg-white/10" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[1, 2, 3, 4].map((metric) => (
              <Skeleton key={metric} className="h-16 rounded-2xl bg-white/10" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GoalEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.025] p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-zinc-300">
        <Target className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-white">Todavía no hay hitos financieros</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-400">
        Creá una meta que valga la pena mirar: ahorro, fecha y aporte sugerido.
      </p>
      <ActionButton type="button" className="mt-5" onClick={onCreate}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Crear hito
      </ActionButton>
    </div>
  );
}

function DeleteGoalDialog({
  goal,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  goal: GoalItem | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {goal ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-xl sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <PremiumCard variant="raised">
              <PremiumCardHeader>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-400/10 text-rose-100">
                    <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <PremiumCardTitle>Eliminar {goal.name}</PremiumCardTitle>
                    <PremiumCardDescription>
                      Se quita este hito de la vista. Los aportes ya registrados no se modifican.
                    </PremiumCardDescription>
                  </div>
                </div>
              </PremiumCardHeader>
              <PremiumCardContent>
                <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-300">
                    <TrendingUp className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                    Progreso actual
                  </div>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-white">
                    {formatMoney(goal.currentAmount, goal.currency)} de {formatMoney(goal.targetAmount, goal.currency)}
                  </p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <ActionButton type="button" variant="glass" onClick={onCancel} disabled={isDeleting}>
                    Cancelar
                  </ActionButton>
                  <ActionButton type="button" variant="danger" onClick={onConfirm} disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    Eliminar
                  </ActionButton>
                </div>
              </PremiumCardContent>
            </PremiumCard>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function buildGoalSummary(goals: GoalItem[]): GoalSummary {
  const activeGoals = goals.filter((goal) => goal.status === "ACTIVE");
  const progressValues = goals.map((goal) => (goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0));
  const nextGoal =
    activeGoals
      .filter((goal) => goal.targetDate)
      .sort((a, b) => new Date(a.targetDate ?? "").getTime() - new Date(b.targetDate ?? "").getTime())[0] ?? null;

  return {
    active: activeGoals.length,
    completed: goals.filter((goal) => goal.status === "COMPLETED").length,
    paused: goals.filter((goal) => goal.status === "PAUSED").length,
    averageProgress:
      progressValues.length > 0
        ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
        : 0,
    monthlyCommitments: activeGoals.reduce<Partial<Record<CurrencyCode, number>>>((acc, goal) => {
      if (goal.requiredMonthlyAmount != null) {
        acc[goal.currency] = (acc[goal.currency] ?? 0) + goal.requiredMonthlyAmount;
      }
      return acc;
    }, {}),
    nextGoal,
  };
}

function getGoalState(summary: GoalSummary, goalCount: number) {
  if (goalCount === 0) {
    return {
      title: "Todavía no hay un norte financiero visible.",
      description: "Creá tu primer hito para que el sistema pueda mostrar ritmo, intención y próximos pasos.",
    };
  }

  if (summary.completed > 0 && summary.active === 0) {
    return {
      title: "Ya cerraste hitos. Toca elegir el próximo.",
      description: "Tenés progreso ganado. Un nuevo objetivo mantiene viva la dirección del mes.",
    };
  }

  if (summary.averageProgress >= 70) {
    return {
      title: "Tus metas están cerca de volverse reales.",
      description: "El progreso promedio ya está alto. Conviene cuidar el ritmo y priorizar el próximo cierre.",
    };
  }

  if (summary.paused > summary.active && summary.paused > 0) {
    return {
      title: "Hay metas pausadas esperando una decisión.",
      description: "Reactivar una sola puede ordenar mejor el flujo del mes sin sumar ruido financiero.",
    };
  }

  return {
    title: "Tus hitos ya tienen dirección.",
    description: "El sistema está siguiendo progreso, aportes y fechas para que cada meta tenga una próxima acción clara.",
  };
}

function formatCommitments(commitments: Partial<Record<CurrencyCode, number>>) {
  const parts = (["ARS", "USD"] as CurrencyCode[])
    .filter((currency) => (commitments[currency] ?? 0) > 0)
    .map((currency) => formatMoney(commitments[currency] ?? 0, currency));

  return parts.length > 0 ? parts.join(" + ") : "Sin aporte";
}

function getStatusClass(status: GoalStatus) {
  if (status === "ACTIVE") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (status === "COMPLETED") return "border-teal-300/20 bg-teal-300/10 text-teal-100";
  if (status === "PAUSED") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  return "border-zinc-300/10 bg-zinc-300/10 text-zinc-300";
}

function formatMoney(value: number, currency: CurrencyCode) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
