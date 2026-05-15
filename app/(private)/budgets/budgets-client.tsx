"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
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
import { onMoneyKeyDown } from "@/lib/input-utils";
import { moneySchema, parseMoneyInput } from "@/lib/money";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CategoryOption = {
  id: string;
  name: string;
  color: string | null;
};

type BudgetItem = {
  id: string;
  categoryId: string;
  currency: "ARS" | "USD";
  year: number;
  month: number;
  plannedAmount: number;
  reservedAmount: number;
  remainingReserved: number;
  spentAmount: number;
  usagePercent: number;
  category: CategoryOption;
};

type BudgetSuggestion = {
  categoryId: string;
  category: CategoryOption;
  currency: "ARS" | "USD";
  suggestedAmount: number;
  recentAverage: number;
  recurringAmount: number;
  incomeSharePercent: number | null;
  confidence: "high" | "medium" | "starter";
  reason: string;
};

type BudgetsClientProps = {
  householdId: string;
  categories: CategoryOption[];
};

type FormState = {
  categoryId: string;
  plannedAmount: string;
  currency: "ARS" | "USD";
};

type FormErrors = Partial<Record<keyof FormState, string>>;

type PlanSummary = {
  totalPlanned: number;
  totalSpent: number;
  totalReserved: number;
  globalPct: number;
  overLimitCount: number;
  watchCount: number;
};

const budgetSchema = z.object({
  categoryId: z.string().min(1, "Seleccioná una categoría."),
  plannedAmount: moneySchema(),
  currency: z.enum(["ARS", "USD"]),
});

const cardMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
} as const;

export function BudgetsClient({ householdId, categories }: BudgetsClientProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const shouldReduceMotion = useReducedMotion();

  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [form, setForm] = useState<FormState>({
    categoryId: categories[0]?.id ?? "",
    plannedAmount: "",
    currency: "ARS",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);
  const [pendingDeleteBudget, setPendingDeleteBudget] = useState<BudgetItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingSuggestions, setIsApplyingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<BudgetSuggestion[]>([]);
  const [suggestionDrafts, setSuggestionDrafts] = useState<Record<string, string>>({});
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
  const [recentMonthlyIncome, setRecentMonthlyIncome] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const availableCategories = useMemo(() => {
    const usedCategoryIds = new Set(
      budgets
        .filter((budget) => budget.id !== editingBudgetId)
        .map((budget) => budget.categoryId),
    );

    return categories.filter((category) => !usedCategoryIds.has(category.id));
  }, [budgets, categories, editingBudgetId]);
  const canCreateBudget = editingBudgetId !== null || availableCategories.length > 0;
  const planSummary = useMemo(() => buildPlanSummary(budgets), [budgets]);
  const selectedSuggestions = useMemo(
    () => suggestions.filter((suggestion) => selectedSuggestionIds.includes(suggestion.categoryId)),
    [selectedSuggestionIds, suggestions],
  );

  const loadSuggestions = useCallback(async () => {
    setIsLoadingSuggestions(true);

    try {
      const params = new URLSearchParams({
        householdId,
        year: String(currentYear),
        month: String(currentMonth),
      });
      const response = await fetch(`/api/budgets/suggestions?${params.toString()}`);
      const payload = (await response.json()) as {
        data?: {
          recentMonthlyIncome: number;
          suggestions: BudgetSuggestion[];
        };
        error?: string;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "No pudimos preparar una distribución inicial.");
        return;
      }

      const nextSuggestions = payload.data?.suggestions ?? [];
      setSuggestions(nextSuggestions);
      setRecentMonthlyIncome(payload.data?.recentMonthlyIncome ?? 0);
      setSuggestionDrafts(
        Object.fromEntries(
          nextSuggestions.map((suggestion) => [
            suggestion.categoryId,
            String(suggestion.suggestedAmount),
          ]),
        ),
      );
      setSelectedSuggestionIds(nextSuggestions.map((suggestion) => suggestion.categoryId));
    } catch {
      toast.error("No pudimos preparar sugerencias. Podés crear el plan manualmente.");
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [currentMonth, currentYear, householdId]);

  const loadBudgets = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({
        householdId,
        year: String(currentYear),
        month: String(currentMonth),
      });
      const response = await fetch(`/api/budgets?${params.toString()}`);
      const payload = (await response.json()) as { data?: BudgetItem[]; error?: string };

      if (!response.ok) {
        toast.error(payload.error ?? "No se pudieron cargar los presupuestos.");
        return;
      }

      setBudgets(payload.data ?? []);
      await loadSuggestions();
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, currentYear, householdId, loadSuggestions]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBudgets();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadBudgets]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const normalizedForm = {
      ...form,
      categoryId: editingBudgetId
        ? form.categoryId
        : availableCategories.some((category) => category.id === form.categoryId)
          ? form.categoryId
          : availableCategories[0]?.id ?? "",
    };
    const parsed = budgetSchema.safeParse(normalizedForm);

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
      const response = await fetch(editingBudgetId ? `/api/budgets/${editingBudgetId}` : "/api/budgets", {
        method: editingBudgetId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId,
          categoryId: parsed.data.categoryId,
          currency: parsed.data.currency,
          year: currentYear,
          month: currentMonth,
          plannedAmount: parsed.data.plannedAmount,
        }),
      });
      const payload = (await response.json()) as { error?: string; fieldErrors?: FormErrors };

      if (!response.ok) {
        if (payload.fieldErrors) setErrors(payload.fieldErrors);
        setMessage(payload.error ?? "No se pudo guardar el presupuesto.");
        return;
      }

      toast.success(editingBudgetId ? "Presupuesto actualizado." : "Presupuesto creado.");
      resetForm();
      await loadBudgets();
    } catch {
      setMessage("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function applySuggestedBudgets() {
    setMessage(null);

    if (selectedSuggestions.length === 0) {
      setMessage("Elegí al menos una categoría sugerida para crear el plan.");
      return;
    }

    const invalidSuggestion = selectedSuggestions.find((suggestion) => {
      const parsed = parseMoneyInput(suggestionDrafts[suggestion.categoryId] ?? "");
      return !parsed.success || parsed.data == null || parsed.data <= 0;
    });

    if (invalidSuggestion) {
      setMessage(`Revisá el monto de ${invalidSuggestion.category.name}.`);
      return;
    }

    setIsApplyingSuggestions(true);

    try {
      for (const suggestion of selectedSuggestions) {
        const parsed = parseMoneyInput(suggestionDrafts[suggestion.categoryId] ?? "");
        if (!parsed.success || parsed.data == null) continue;

        const response = await fetch("/api/budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            householdId,
            categoryId: suggestion.categoryId,
            currency: suggestion.currency,
            year: currentYear,
            month: currentMonth,
            plannedAmount: parsed.data,
          }),
        });
        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          setMessage(payload.error ?? `No se pudo crear el plan de ${suggestion.category.name}.`);
          return;
        }
      }

      toast.success("Distribución inicial creada.");
      await loadBudgets();
    } catch {
      setMessage("Error de red. No pudimos crear la distribución inicial.");
    } finally {
      setIsApplyingSuggestions(false);
    }
  }

  function updateSuggestionDraft(categoryId: string, value: string) {
    setSuggestionDrafts((current) => ({ ...current, [categoryId]: value }));
  }

  function toggleSuggestion(categoryId: string) {
    setSelectedSuggestionIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  function requestDelete(budget: BudgetItem) {
    setPendingDeleteBudget(budget);
  }

  async function confirmDelete() {
    if (!pendingDeleteBudget) return;

    const budgetId = pendingDeleteBudget.id;
    setDeletingBudgetId(budgetId);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/budgets/${budgetId}?${new URLSearchParams({ householdId }).toString()}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(payload.error ?? "No se pudo eliminar el presupuesto.");
        return;
      }

      toast.success("Presupuesto eliminado.");
      setPendingDeleteBudget(null);
      if (editingBudgetId === budgetId) {
        resetForm();
      }

      await loadBudgets();
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setDeletingBudgetId(null);
    }
  }

  function startEditing(budget: BudgetItem) {
    setEditingBudgetId(budget.id);
    setErrors({});
    setMessage(null);
    setForm({
      categoryId: budget.categoryId,
      plannedAmount: String(budget.plannedAmount),
      currency: budget.currency,
    });
  }

  function resetForm() {
    setEditingBudgetId(null);
    setErrors({});
    const usedCategoryIds = new Set(budgets.map((budget) => budget.categoryId));
    const nextCategory = categories.find((category) => !usedCategoryIds.has(category.id));

    setForm({
      categoryId: nextCategory?.id ?? "",
      plannedAmount: "",
      currency: "ARS",
    });
  }

  function updateForm<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  const selectedCategoryId =
    editingBudgetId || availableCategories.some((category) => category.id === form.categoryId)
      ? form.categoryId
      : availableCategories[0]?.id ?? "";

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <motion.div {...(shouldReduceMotion ? { initial: false } : cardMotion)}>
          <PremiumCard variant="raised" className="overflow-hidden">
            <PremiumCardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <PremiumCardTitle>{editingBudgetId ? "Ajustar intención" : "Plan preparado"}</PremiumCardTitle>
                  <PremiumCardDescription>
                    {editingBudgetId ? formatMonth(currentYear, currentMonth) : "Una base editable para este mes"}
                  </PremiumCardDescription>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
            </PremiumCardHeader>
            <PremiumCardContent>
              {categories.length === 0 ? (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4">
                    <p className="text-sm font-semibold text-white">Primero necesitás categorías de gasto</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                      Creá una categoría de gasto para asignarle intención mensual.
                    </p>
                  </div>
                  <ActionButton asChild className="w-full">
                    <Link href="/categories">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Crear categoría
                    </Link>
                  </ActionButton>
                </div>
              ) : (
                <div className="space-y-5">
                  {!editingBudgetId ? (
                    <SuggestedPlanPanel
                      suggestions={suggestions}
                      drafts={suggestionDrafts}
                      selectedIds={selectedSuggestionIds}
                      recentMonthlyIncome={recentMonthlyIncome}
                      isLoading={isLoadingSuggestions}
                      isApplying={isApplyingSuggestions}
                      onAmountChange={updateSuggestionDraft}
                      onToggle={toggleSuggestion}
                      onApply={applySuggestedBudgets}
                    />
                  ) : null}

                  <div className="border-t border-white/[0.08] pt-5">
                    <p className="mb-4 text-xs font-semibold uppercase text-zinc-500">
                      {editingBudgetId ? "Editar categoría" : "Ajuste manual"}
                    </p>
                    <form className="space-y-4" onSubmit={handleSubmit}>
                      {!editingBudgetId && availableCategories.length === 0 ? (
                        <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                          <p className="text-sm font-semibold text-white">Todas las categorías ya tienen plan</p>
                          <p className="mt-1 text-xs leading-5 text-zinc-400">
                            Editá una intención existente o liberá una categoría.
                          </p>
                        </div>
                      ) : null}

                      <Field label="Categoría" error={errors.categoryId}>
                        <select
                          className="v2-focus-ring h-11 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-base md:text-sm text-white outline-none transition hover:bg-white/[0.07]"
                          value={selectedCategoryId}
                          onChange={(event) => updateForm("categoryId", event.target.value)}
                          disabled={!canCreateBudget}
                        >
                          {availableCategories.length === 0 ? <option value="">Sin categorías disponibles</option> : null}
                          {availableCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <div className="grid gap-3 sm:grid-cols-[104px_1fr]">
                        <Field label="Moneda" error={errors.currency}>
                          <select
                            className="v2-focus-ring h-11 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-base md:text-sm text-white outline-none transition hover:bg-white/[0.07]"
                            value={form.currency}
                            onChange={(event) => updateForm("currency", event.target.value as "ARS" | "USD")}
                          >
                            <option value="ARS">ARS</option>
                            <option value="USD">USD</option>
                          </select>
                        </Field>
                        <Field label="Monto" error={errors.plannedAmount}>
                          <Input
                            inputMode="decimal"
                            onKeyDown={onMoneyKeyDown}
                            value={form.plannedAmount}
                            onChange={(event) => updateForm("plannedAmount", event.target.value)}
                            placeholder="0"
                            className="v2-focus-ring h-11 rounded-2xl border-white/10 bg-white/[0.05] text-white placeholder:text-zinc-600"
                          />
                        </Field>
                      </div>

                      {message ? (
                        <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">
                          {message}
                        </p>
                      ) : null}

                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                        <ActionButton
                          className="w-full"
                          disabled={isSaving || (!editingBudgetId && availableCategories.length === 0)}
                        >
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                          {editingBudgetId ? "Guardar cambios" : "Crear ajuste"}
                        </ActionButton>
                        {editingBudgetId ? (
                          <ActionButton type="button" variant="glass" className="w-full" onClick={resetForm}>
                            <X className="h-4 w-4" aria-hidden="true" />
                            Cancelar
                          </ActionButton>
                        ) : null}
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </PremiumCardContent>
          </PremiumCard>
        </motion.div>

        <div className="space-y-5">
          <PlanBriefing summary={planSummary} budgetCount={budgets.length} isLoading={isLoading} />

          <PremiumCard variant="default" className="overflow-hidden">
            <PremiumCardHeader className="pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <PremiumCardTitle>Intenciones activas</PremiumCardTitle>
                  <PremiumCardDescription>{formatMonth(currentYear, currentMonth)}</PremiumCardDescription>
                </div>
                <Badge className="w-fit border-white/10 bg-white/[0.06] text-zinc-200">
                  {budgets.length} activas
                </Badge>
              </div>
            </PremiumCardHeader>
            <PremiumCardContent>
              {isLoading ? (
                <BudgetSkeletonList />
              ) : budgets.length === 0 ? (
                <PlanEmptyState />
              ) : (
                <div className="grid gap-3">
                  <AnimatePresence initial={false}>
                    {budgets.map((budget) => (
                      <BudgetCard
                        key={budget.id}
                        budget={budget}
                        isDeleting={deletingBudgetId === budget.id}
                        onEdit={startEditing}
                        onDelete={requestDelete}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </PremiumCardContent>
          </PremiumCard>
        </div>
      </div>

      <DeleteBudgetDialog
        budget={pendingDeleteBudget}
        isDeleting={deletingBudgetId === pendingDeleteBudget?.id}
        onCancel={() => setPendingDeleteBudget(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function PlanBriefing({
  summary,
  budgetCount,
  isLoading,
}: {
  summary: PlanSummary;
  budgetCount: number;
  isLoading: boolean;
}) {
  const state = getPlanState(summary, budgetCount);
  const progressWidth = Math.min(summary.globalPct, 100);
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div {...(shouldReduceMotion ? { initial: false } : cardMotion)} transition={shouldReduceMotion ? undefined : { ...cardMotion.transition, delay: 0.05 }}>
      <PremiumCard variant="raised" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_22%_0%,rgba(45,212,191,0.18),transparent_38%),radial-gradient(circle_at_78%_0%,rgba(244,114,182,0.13),transparent_34%)]" />
        <PremiumCardContent className="relative p-5 sm:p-6">
          {isLoading ? (
            <div className="space-y-5">
              <Skeleton className="h-5 w-36 rounded-full bg-white/10" />
              <Skeleton className="h-8 w-72 max-w-full rounded-full bg-white/10" />
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
                    <Sparkles className="h-3.5 w-3.5 text-teal-200" aria-hidden="true" />
                    Plan inteligente
                  </div>
                  <h2 className="text-balance text-2xl font-semibold leading-tight text-white sm:text-3xl">
                    {state.title}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">{state.description}</p>
                </div>

                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.055] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <div className="text-center">
                    <p className="text-3xl font-semibold tabular-nums text-white">{summary.globalPct}%</p>
                    <p className="text-[10px] font-semibold uppercase text-zinc-500">usado</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className={`h-full rounded-full ${state.progressClass}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressWidth}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <PlanMetric icon={Target} label="Intención" value={formatMoney(summary.totalPlanned, "ARS")} />
                <PlanMetric icon={WalletCards} label="Ritmo actual" value={formatMoney(summary.totalSpent, "ARS")} />
                <PlanMetric icon={CheckCircle2} label="Margen cuidado" value={formatMoney(summary.totalReserved, "ARS")} />
              </div>
            </>
          )}
        </PremiumCardContent>
      </PremiumCard>
    </motion.div>
  );
}

function SuggestedPlanPanel({
  suggestions,
  drafts,
  selectedIds,
  recentMonthlyIncome,
  isLoading,
  isApplying,
  onAmountChange,
  onToggle,
  onApply,
}: {
  suggestions: BudgetSuggestion[];
  drafts: Record<string, string>;
  selectedIds: string[];
  recentMonthlyIncome: number;
  isLoading: boolean;
  isApplying: boolean;
  onAmountChange: (categoryId: string, value: string) => void;
  onToggle: (categoryId: string) => void;
  onApply: () => void;
}) {
  const selectedTotal = suggestions.reduce((sum, suggestion) => {
    if (!selectedIds.includes(suggestion.categoryId)) return sum;
    const parsed = parseMoneyInput(drafts[suggestion.categoryId] ?? "");
    return sum + (parsed.success && parsed.data ? parsed.data : 0);
  }, 0);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-48 rounded-full bg-white/10" />
        <Skeleton className="h-16 rounded-3xl bg-white/10" />
        <Skeleton className="h-16 rounded-3xl bg-white/10" />
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-4">
        <p className="text-sm font-semibold text-white">El mes ya tiene una base clara</p>
        <p className="mt-1 text-xs leading-5 text-zinc-400">
          No quedan categorías libres para sugerir. Podés ajustar cualquier intención activa cuando lo necesites.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-teal-300/20 bg-teal-300/10 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-teal-100" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-white">Meridian preparó una distribución inicial</p>
            <p className="mt-1 text-xs leading-5 text-zinc-300">
              Basada en cómo suele moverse tu dinero. Ajustá, quitá o confirmá lo que tenga sentido.
            </p>
            {recentMonthlyIncome > 0 ? (
              <p className="mt-2 text-xs text-teal-100/80">
                Ingreso mensual reciente: <SensitiveAmount value={formatMoney(recentMonthlyIncome, "ARS")} />
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion) => {
          const selected = selectedIds.includes(suggestion.categoryId);

          return (
            <div
              key={suggestion.categoryId}
              className={`rounded-3xl border p-3 transition ${
                selected ? "border-white/[0.14] bg-white/[0.055]" : "border-white/[0.06] bg-white/[0.025] opacity-70"
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={selected ? `Quitar ${suggestion.category.name}` : `Incluir ${suggestion.category.name}`}
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                    selected ? "border-emerald-300/50 bg-emerald-300/20 text-emerald-100" : "border-white/15 bg-white/[0.03] text-transparent"
                  }`}
                  onClick={() => onToggle(suggestion.categoryId)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{suggestion.category.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{suggestion.reason}</p>
                    </div>
                    <Badge className={getSuggestionBadgeClass(suggestion.confidence)}>
                      {getSuggestionLabel(suggestion.confidence)}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center xl:grid-cols-1 2xl:grid-cols-[1fr_auto]">
                    <Input
                      inputMode="decimal"
                      onKeyDown={onMoneyKeyDown}
                      value={drafts[suggestion.categoryId] ?? ""}
                      onChange={(event) => onAmountChange(suggestion.categoryId, event.target.value)}
                      disabled={!selected}
                      className="v2-focus-ring h-10 rounded-2xl border-white/10 bg-zinc-950/50 text-white placeholder:text-zinc-600 disabled:opacity-50"
                    />
                    <p className="text-xs text-zinc-500">
                      {suggestion.incomeSharePercent != null ? `${suggestion.incomeSharePercent}% del ingreso` : "Editable"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-3xl border border-white/[0.08] bg-black/15 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-500">Total sugerido</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">
              <SensitiveAmount value={formatMoney(selectedTotal, "ARS")} />
            </p>
          </div>
          <ActionButton
            type="button"
            size="sm"
            disabled={isApplying || selectedIds.length === 0}
            onClick={onApply}
          >
            {isApplying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Confirmar
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function PlanMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-4">
      <Icon className="h-4 w-4 text-zinc-400" aria-hidden />
      <p className="mt-3 text-[11px] font-medium uppercase text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-white">
        <SensitiveAmount value={value} />
      </p>
    </div>
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

function BudgetCard({
  budget,
  isDeleting,
  onEdit,
  onDelete,
}: {
  budget: BudgetItem;
  isDeleting: boolean;
  onEdit: (budget: BudgetItem) => void;
  onDelete: (budget: BudgetItem) => void;
}) {
  const usage = Math.min(budget.usagePercent, 999);
  const alert = getBudgetAlert(budget.usagePercent);
  const remaining = budget.remainingReserved;
  const exceededAmount = Math.max(budget.spentAmount - budget.plannedAmount, 0);
  const shouldReduceMotion = useReducedMotion();
  const [displayWidth, setDisplayWidth] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    const timer = setTimeout(() => setDisplayWidth(Math.min(budget.usagePercent, 100)), 120);
    return () => clearTimeout(timer);
  }, [budget.usagePercent]);

  return (
    <motion.article
      layout
      {...(shouldReduceMotion ? { initial: false } : cardMotion)}
      className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.035] p-4 transition duration-200 hover:border-white/[0.16] hover:bg-white/[0.055] sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span
              className="mt-1 h-4 w-4 shrink-0 rounded-full shadow-[0_0_18px_rgba(255,255,255,0.16)]"
              style={{ backgroundColor: budget.category.color ?? "#14b8a6" }}
            />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">{budget.category.name}</p>
              <p className="mt-1 text-sm leading-5 text-zinc-400">
                <SensitiveAmount value={formatMoney(budget.spentAmount, budget.currency)} /> usados de{" "}
                <SensitiveAmount value={formatMoney(budget.plannedAmount, budget.currency)} />
              </p>
              {exceededAmount > 0 ? (
                <p className="mt-2 inline-flex rounded-full border border-rose-300/20 bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-100">
                  El gasto superó el plan por <SensitiveAmount value={formatMoney(exceededAmount, budget.currency)} />
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className="border-white/10 bg-white/[0.06] text-zinc-200">{usage.toFixed(0)}% del plan</Badge>
          <Badge className={alert.className}>{alert.label}</Badge>
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${getProgressClass(budget.usagePercent)}`}
          style={{ width: `${displayWidth}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <BudgetMetric label="Plan" value={formatMoney(budget.plannedAmount, budget.currency)} />
        <BudgetMetric label="Actual" value={formatMoney(budget.spentAmount, budget.currency)} />
        <BudgetMetric
          label={exceededAmount > 0 ? "Diferencia" : "Cuidado"}
          value={formatMoney(exceededAmount > 0 ? exceededAmount : remaining, budget.currency)}
        />
        <BudgetMetric label="Ritmo" value={`${usage.toFixed(0)}%`} sensitive={false} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
        <ActionButton type="button" variant="glass" size="sm" onClick={() => onEdit(budget)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Editar
        </ActionButton>
        <ActionButton
          type="button"
          variant="danger"
          size="sm"
          disabled={isDeleting}
          onClick={() => onDelete(budget)}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          )}
          Eliminar
        </ActionButton>
      </div>
    </motion.article>
  );
}

function BudgetMetric({ label, value, sensitive = true }: { label: string; value: string; sensitive?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-black/15 p-3">
      <p className="text-[10px] font-medium uppercase text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-white">
        {sensitive ? <SensitiveAmount value={value} /> : value}
      </p>
    </div>
  );
}

function BudgetSkeletonList() {
  return (
    <div className="grid gap-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="space-y-4 rounded-[1.75rem] border border-white/[0.08] bg-white/[0.035] p-4">
          <div className="flex gap-3">
            <Skeleton className="mt-1 h-4 w-4 shrink-0 rounded-full bg-white/10" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32 bg-white/10" />
              <Skeleton className="h-3 w-48 max-w-full bg-white/10" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full bg-white/10" />
          </div>
          <Skeleton className="h-2 w-full rounded-full bg-white/10" />
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

function PlanEmptyState() {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.025] p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-zinc-300">
        <BarChart3 className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-white">Tu distribución inicial está lista para ajustar</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-400">
        Confirmá las sugerencias o ajustá una categoría puntual. No hace falta armar el mes desde cero.
      </p>
    </div>
  );
}

function DeleteBudgetDialog({
  budget,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  budget: BudgetItem | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {budget ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-xl sm:items-center"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-md"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={shouldReduceMotion ? undefined : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <PremiumCard variant="raised">
              <PremiumCardHeader>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-400/10 text-rose-100">
                    <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <PremiumCardTitle>Eliminar plan de {budget.category.name}</PremiumCardTitle>
                    <PremiumCardDescription>
                      Se va a quitar esta intención mensual. El historial de gastos no se modifica.
                    </PremiumCardDescription>
                  </div>
                </div>
              </PremiumCardHeader>
              <PremiumCardContent>
                <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-300">
                    <CalendarDays className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                    Plan actual
                  </div>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-white">
                    <SensitiveAmount value={formatMoney(budget.plannedAmount, budget.currency)} />
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

function buildPlanSummary(budgets: BudgetItem[]): PlanSummary {
  const totalPlanned = budgets.reduce((sum, budget) => sum + budget.plannedAmount, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spentAmount, 0);
  const totalReserved = budgets.reduce((sum, budget) => sum + budget.remainingReserved, 0);

  return {
    totalPlanned,
    totalSpent,
    totalReserved,
    globalPct: totalPlanned > 0 ? Math.round((totalSpent / totalPlanned) * 100) : 0,
    overLimitCount: budgets.filter((budget) => budget.usagePercent >= 100).length,
    watchCount: budgets.filter((budget) => budget.usagePercent >= 80 && budget.usagePercent < 100).length,
  };
}

function getPlanState(summary: PlanSummary, budgetCount: number) {
  if (budgetCount === 0) {
    return {
      title: "Tu mes todavía no tiene intención.",
      description: "Creá el primer plan y convertí tus categorías en decisiones visibles antes de que el gasto ocurra.",
      progressClass: "bg-gradient-to-r from-zinc-500 to-zinc-300",
    };
  }

  if (summary.overLimitCount > 0 || summary.globalPct >= 100) {
    return {
      title: "Este mes el gasto superó lo planificado.",
      description: `${summary.overLimitCount} ${
        summary.overLimitCount === 1 ? "categoría quedó" : "categorías quedaron"
      } por encima de la intención. Conviene mirar el ritmo antes de cerrar el mes.`,
      progressClass: "bg-gradient-to-r from-rose-400 via-orange-300 to-rose-300",
    };
  }

  if (summary.watchCount > 0 || summary.globalPct >= 80) {
    return {
      title: "El ritmo pide una mirada tranquila.",
      description: "Algunas categorías avanzan más rápido que el mes. Un ajuste chico ahora evita una corrección grande después.",
      progressClass: "bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300",
    };
  }

  return {
    title: "El ritmo de gasto sigue estable.",
    description: "El gasto todavía respeta la intención del mes. Lo importante está reservado y el margen sigue claro.",
    progressClass: "bg-gradient-to-r from-teal-300 via-emerald-300 to-lime-200",
  };
}

function getBudgetAlert(usagePercent: number) {
  if (usagePercent >= 100) {
    return {
      label: "Excedido",
      className: "border-rose-300/20 bg-rose-400/10 text-rose-100",
    };
  }

  if (usagePercent >= 80) {
    return {
      label: "Cerca del límite",
      className: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    };
  }

  return {
    label: "En ritmo",
    className: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
  };
}

function getSuggestionLabel(confidence: BudgetSuggestion["confidence"]) {
  if (confidence === "high") return "Fuerte";
  if (confidence === "medium") return "Reciente";
  return "Base";
}

function getSuggestionBadgeClass(confidence: BudgetSuggestion["confidence"]) {
  if (confidence === "high") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (confidence === "medium") return "border-sky-300/20 bg-sky-300/10 text-sky-100";
  return "border-white/10 bg-white/[0.06] text-zinc-200";
}

function getProgressClass(usagePercent: number) {
  if (usagePercent >= 100) {
    return "bg-gradient-to-r from-rose-500 via-orange-400 to-rose-300";
  }

  if (usagePercent >= 80) {
    return "bg-gradient-to-r from-amber-400 via-orange-300 to-rose-300";
  }

  return "bg-gradient-to-r from-teal-300 via-emerald-300 to-lime-200";
}

function formatMoney(value: number, currency: "ARS" | "USD") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonth(year: number, month: number) {
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}
