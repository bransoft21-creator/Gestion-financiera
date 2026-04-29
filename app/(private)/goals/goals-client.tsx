"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Loader2, Pencil, Plus, Sparkles, Target, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { EmptyState } from "@/components/app/empty-state";
import {
  AppFormPanel,
  MobileCreateFab,
  appFormActionsClass,
  appFormContentClass,
} from "@/components/app/mobile-form";
import { moneySchema, optionalMoneySchema } from "@/lib/money";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type GoalStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELED";
type CurrencyCode = "ARS" | "USD";

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

export function GoalsClient({ householdId }: GoalsClientProps) {
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  async function handleDelete(goalId: string) {
    const shouldDelete = window.confirm("¿Eliminar esta meta? Se aplicará soft delete.");

    if (!shouldDelete) {
      return;
    }

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

  const active = goals.filter((g) => g.status === "ACTIVE").length;
  const completed = goals.filter((g) => g.status === "COMPLETED").length;
  const paused = goals.filter((g) => g.status === "PAUSED").length;

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <AppFormPanel isOpen={isFormOpen} onClose={() => setIsFormOpen(false)}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>{editingGoalId ? "Editar meta" : "Nueva meta"}</CardTitle>
              <CardDescription>Objetivo, progreso y fecha esperada.</CardDescription>
            </div>
            <Button type="button" variant="ghost" size="icon" className="ml-auto xl:hidden" onClick={() => setIsFormOpen(false)}>
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className={appFormContentClass(isFormOpen)}>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="Nombre" error={errors.name}>
              <Input value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-[96px_1fr]">
              <Field label="Moneda" error={errors.currency}>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Actual" error={errors.currentAmount}>
                <Input
                  inputMode="decimal"
                  value={form.currentAmount}
                  onChange={(event) => updateForm("currentAmount", event.target.value)}
                />
              </Field>
              <Field label="Aporte mensual" error={errors.requiredMonthlyAmount}>
                <Input
                  inputMode="decimal"
                  value={form.requiredMonthlyAmount}
                  onChange={(event) => updateForm("requiredMonthlyAmount", event.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fecha objetivo" error={errors.targetDate}>
                <Input
                  type="date"
                  value={form.targetDate}
                  onChange={(event) => updateForm("targetDate", event.target.value)}
                />
              </Field>
              <Field label="Estado" error={errors.status}>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.status}
                  onChange={(event) => updateForm("status", event.target.value as GoalStatus)}
                >
                  {(editingGoalId ? statuses : statuses.filter((s) => s !== "CANCELED")).map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Notas" error={errors.notes}>
              <textarea
                className="min-h-20 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
              />
            </Field>

            {message ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null}

            <div className={appFormActionsClass("xl:grid-cols-1 2xl:grid-cols-2")}>
              <Button className="h-11 w-full" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {editingGoalId ? "Guardar cambios" : "Crear meta"}
              </Button>
              {editingGoalId ? (
                <Button type="button" variant="outline" className="h-11 w-full" onClick={() => { resetForm(); setIsFormOpen(false); }}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </AppFormPanel>

      <div className="space-y-5">
        {/* Summary chips */}
        {!isLoading && goals.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              <span className="text-[13px] font-semibold text-emerald-400">{active} activas</span>
            </div>
            {paused > 0 && (
              <div className="flex items-center gap-2 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3.5 py-2">
                <span className="text-[13px] font-semibold text-yellow-400">{paused} pausadas</span>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3.5 py-2">
              <Target className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
              <span className="text-[13px] font-semibold text-violet-400">{completed} completadas</span>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Listado</CardTitle>
                  <CardDescription>{goals.length} metas activas o históricas.</CardDescription>
                </div>
              <div className="flex items-center gap-2">
                <Badge title="Solo metas activas con aporte mensual definido se suman como obligación en el dashboard">Activa + aporte → dashboard</Badge>
                <Button type="button" size="sm" className="hidden xl:inline-flex" onClick={() => { resetForm(); setIsFormOpen(true); }}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Nueva
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
          {isLoading ? (
            <div className="grid gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-border p-4 space-y-4">
                  <div className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-16 w-16 rounded-full shrink-0" />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[1,2,3,4].map((j) => <Skeleton key={j} className="h-14 rounded-xl" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : goals.length === 0 ? (
            <EmptyState
              icon={Target}
              title="Sin metas financieras"
              description="Creá una meta para seguir ahorro, progreso y fecha objetivo."
            />
          ) : (
            <div className="grid gap-3">
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  isDeleting={deletingGoalId === goal.id}
                  onEdit={startEditing}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
        </Card>
      </div>
      <MobileCreateFab label="Nueva meta" onClick={() => { resetForm(); setIsFormOpen(true); }} />
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

function CircularProgress({ value, size = 72, strokeWidth = 6 }: { value: number; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);

  useEffect(() => {
    const t = setTimeout(() => setOffset(circ - (Math.min(value, 100) / 100) * circ), 120);
    return () => clearTimeout(t);
  }, [value, circ]);

  const color = value >= 100 ? "#a78bfa" : value >= 60 ? "#34d399" : value >= 30 ? "#60a5fa" : "#fbbf24";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.85s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700, color: "hsl(var(--foreground))" }}>
        {Math.round(value)}%
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  isDeleting,
  onEdit,
  onDelete,
}: {
  goal: GoalItem;
  isDeleting: boolean;
  onEdit: (goal: GoalItem) => void;
  onDelete: (goalId: string) => void;
}) {
  const actualPct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
  const displayPct = Math.min(actualPct, 100);
  const impactsDashboard = goal.status === "ACTIVE" && goal.requiredMonthlyAmount != null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-border/80 animate-fade-up">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Target className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{goal.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatMoney(goal.currentAmount, goal.currency)} de {formatMoney(goal.targetAmount, goal.currency)}
            </p>
            {goal.targetDate ? (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" aria-hidden="true" />
                {formatDate(goal.targetDate)}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>{statusLabels[goal.status]}</Badge>
              {goal.requiredMonthlyAmount ? (
                <Badge>{formatMoney(goal.requiredMonthlyAmount, goal.currency)} / mes</Badge>
              ) : null}
              {impactsDashboard ? (
                <Badge className="border-emerald-500/30 text-emerald-400">impacta dashboard</Badge>
              ) : null}
            </div>
          </div>
        </div>
        <CircularProgress value={displayPct} size={68} strokeWidth={5} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <GoalMetric label="Actual" value={formatMoney(goal.currentAmount, goal.currency)} />
        <GoalMetric label="Objetivo" value={formatMoney(goal.targetAmount, goal.currency)} />
        <GoalMetric label="Progreso" value={`${actualPct.toFixed(0)}%`} />
        <GoalMetric label="Estado" value={statusLabels[goal.status]} />
      </div>

      {goal.notes ? <p className="mt-3 text-sm text-muted-foreground">{goal.notes}</p> : null}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
        <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => onEdit(goal)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Editar
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-10"
          disabled={isDeleting}
          onClick={() => onDelete(goal.id)}
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

function GoalMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/50 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
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
