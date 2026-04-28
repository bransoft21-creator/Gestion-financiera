"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BarChart3, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { EmptyState } from "@/components/app/empty-state";
import { moneySchema } from "@/lib/money";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const budgetSchema = z.object({
  categoryId: z.string().min(1, "Seleccioná una categoría."),
  plannedAmount: moneySchema(),
  currency: z.enum(["ARS", "USD"]),
});

export function BudgetsClient({ householdId, categories }: BudgetsClientProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [form, setForm] = useState<FormState>({
    categoryId: categories[0]?.id ?? "",
    plannedAmount: "",
    currency: "ARS",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const availableCategories = useMemo(() => {
    const usedCategoryIds = new Set(
      budgets
        .filter((budget) => budget.id !== editingBudgetId)
        .map((budget) => budget.categoryId),
    );

    return categories.filter((category) => !usedCategoryIds.has(category.id));
  }, [budgets, categories, editingBudgetId]);

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
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, currentYear, householdId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBudgets();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadBudgets]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const parsed = budgetSchema.safeParse(form);

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

  async function handleDelete(budgetId: string) {
    const shouldDelete = window.confirm("¿Eliminar este presupuesto mensual? Se aplicará soft delete.");

    if (!shouldDelete) {
      return;
    }

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
    setForm({
      categoryId: availableCategories[0]?.id ?? categories[0]?.id ?? "",
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

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>{editingBudgetId ? "Editar presupuesto" : "Nuevo presupuesto"}</CardTitle>
              <CardDescription>{formatMonth(currentYear, currentMonth)}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
                <p className="text-sm font-semibold text-foreground">Necesitás categorías de gasto</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Creá al menos una categoría de tipo <strong>Gasto</strong> para poder asignarle un presupuesto mensual.
                </p>
              </div>
              <Button asChild className="h-11 w-full">
                <Link href="/categories">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Crear categoría de gasto
                </Link>
              </Button>
            </div>
          ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {!editingBudgetId && availableCategories.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-sm font-semibold text-foreground">Todas las categorías ya tienen presupuesto</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Editá uno existente o eliminalo para crear uno nuevo en esa categoría.
                </p>
              </div>
            ) : null}

            <Field label="Categoría" error={errors.categoryId}>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.categoryId}
                onChange={(event) => updateForm("categoryId", event.target.value)}
              >
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-[96px_1fr]">
              <Field label="Moneda" error={errors.currency}>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  value={form.plannedAmount}
                  onChange={(event) => updateForm("plannedAmount", event.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>

            {message ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null}

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Button className="h-11 w-full" disabled={isSaving || (!editingBudgetId && availableCategories.length === 0)}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {editingBudgetId ? "Guardar cambios" : "Crear presupuesto"}
              </Button>
              {editingBudgetId ? (
                <Button type="button" variant="outline" className="h-11 w-full" onClick={resetForm}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        {/* Global summary card */}
        {!isLoading && budgets.length > 0 && (() => {
          const totalPlanned = budgets.reduce((s, b) => s + b.plannedAmount, 0);
          const totalSpent = budgets.reduce((s, b) => s + b.spentAmount, 0);
          const totalReserved = budgets.reduce((s, b) => s + b.remainingReserved, 0);
          const globalPct = totalPlanned > 0 ? Math.round((totalSpent / totalPlanned) * 100) : 0;
          const barColor = globalPct >= 100 ? "#f87171" : globalPct >= 80 ? "#fbbf24" : "#34d399";
          return (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Progreso global del mes</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">
                    {globalPct}%{" "}
                    <span className="text-sm font-normal text-muted-foreground">usado</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-4">
                  {[
                    { label: "Presupuestado", val: totalPlanned, color: "text-foreground" },
                    { label: "Gastado", val: totalSpent, color: globalPct > 80 ? "text-amber-400" : "text-emerald-400" },
                    { label: "Reservado", val: totalReserved, color: "text-foreground" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="text-right">
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                      <p className={`text-[15px] font-bold tabular-nums ${color}`}>{formatMoney(val, "ARS")}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.min(globalPct, 100)}%`, background: `linear-gradient(90deg,${barColor}99,${barColor})` }} />
              </div>
            </div>
          );
        })()}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Presupuestos del mes</CardTitle>
                <CardDescription>{formatMonth(currentYear, currentMonth)}</CardDescription>
              </div>
              <Badge>{budgets.length} activos</Badge>
            </div>
          </CardHeader>
          <CardContent>
          {isLoading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex gap-3">
                    <Skeleton className="h-4 w-4 rounded-sm mt-1 shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                  <div className="grid grid-cols-4 gap-2">
                    {[1,2,3,4].map((j) => <Skeleton key={j} className="h-14 rounded-xl" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : budgets.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Sin presupuestos este mes"
              description="Creá un presupuesto por categoría para comparar el gasto real contra lo planificado."
            />
          ) : (
            <div className="grid gap-3">
              {budgets.map((budget) => (
                <BudgetCard
                  key={budget.id}
                  budget={budget}
                  isDeleting={deletingBudgetId === budget.id}
                  onEdit={startEditing}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
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
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
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
  onDelete: (budgetId: string) => void;
}) {
  const usage = Math.min(budget.usagePercent, 999);
  const alert = getBudgetAlert(budget.usagePercent);
  const remaining = budget.remainingReserved;
  const [displayWidth, setDisplayWidth] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    const timer = setTimeout(() => setDisplayWidth(Math.min(budget.usagePercent, 100)), 120);
    return () => clearTimeout(timer);
  }, [budget.usagePercent]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-border/80 animate-fade-up">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span
              className="mt-1 h-4 w-4 shrink-0 rounded-sm"
              style={{ backgroundColor: budget.category.color ?? "#64748b" }}
            />
            <div>
              <p className="text-sm font-semibold">{budget.category.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatMoney(budget.spentAmount, budget.currency)} gastado de{" "}
                {formatMoney(budget.plannedAmount, budget.currency)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge>{usage.toFixed(0)}% usado</Badge>
          {alert ? <Badge className={alert.className}>{alert.label}</Badge> : null}
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${getProgressClass(budget.usagePercent)}`}
          style={{ width: `${displayWidth}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <BudgetMetric label="Presupuestado" value={formatMoney(budget.plannedAmount, budget.currency)} />
        <BudgetMetric label="Gastado" value={formatMoney(budget.spentAmount, budget.currency)} />
        <BudgetMetric label="Reservado" value={formatMoney(remaining, budget.currency)} />
        <BudgetMetric label="Uso" value={`${usage.toFixed(0)}%`} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
        <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => onEdit(budget)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Editar
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-10"
          disabled={isDeleting}
          onClick={() => onDelete(budget.id)}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          )}
          Eliminar
        </Button>
      </div>
    </div>
  );
}

function BudgetMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/50 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function getBudgetAlert(usagePercent: number) {
  if (usagePercent >= 100) {
    return {
      label: "Superado",
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    };
  }

  if (usagePercent >= 80) {
    return {
      label: "Atención",
      className: "border-amber-300 bg-amber-50 text-amber-700",
    };
  }

  return null;
}

function getProgressClass(usagePercent: number) {
  if (usagePercent >= 100) {
    return "bg-gradient-to-r from-rose-600 to-rose-500";
  }

  if (usagePercent >= 80) {
    return "bg-gradient-to-r from-amber-600 to-amber-400";
  }

  return "bg-gradient-to-r from-violet-600 to-indigo-500";
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
