"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { EmptyState } from "@/components/app/empty-state";
import {
  AppFormPanel,
  MobileCreateFab,
  appFormActionsClass,
  appFormContentClass,
  appFormHeaderClass,
} from "@/components/app/mobile-form";
import { moneySchema } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Frequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
type CurrencyCode = "ARS" | "USD";

type AccountOption = { id: string; name: string };
type CategoryOption = { id: string; name: string; type: string };

type RecurringItem = {
  id: string;
  name: string;
  currency: CurrencyCode;
  amount: number;
  frequency: Frequency;
  nextDueDate: string;
  endDate: string | null;
  isActive: boolean;
  notes: string | null;
  daysUntilDue: number;
  isDueSoon: boolean;
  account: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
};

type RecurringClientProps = {
  householdId: string;
  accounts: AccountOption[];
  categories: CategoryOption[];
};

type FormState = {
  name: string;
  currency: CurrencyCode;
  amount: string;
  frequency: Frequency;
  nextDueDate: string;
  endDate: string;
  accountId: string;
  categoryId: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const frequencyLabels: Record<Frequency, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual",
  QUARTERLY: "Trimestral",
  YEARLY: "Anual",
};

const frequencies = Object.keys(frequencyLabels) as Frequency[];

const formSchema = z.object({
  name: z.string().trim().min(2, "Ingresá un nombre.").max(100),
  currency: z.enum(["ARS", "USD"]),
  amount: moneySchema(),
  frequency: z.enum(frequencies as [Frequency, ...Frequency[]]),
  nextDueDate: z.string().min(1, "Seleccioná la próxima fecha.").regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.").optional().or(z.literal("")),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
}).superRefine((data, ctx) => {
  if (data.endDate && data.endDate !== "" && data.nextDueDate && data.endDate <= data.nextDueDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La fecha de fin debe ser posterior al próximo vencimiento.",
      path: ["endDate"],
    });
  }
});

const defaultForm: FormState = {
  name: "",
  currency: "ARS",
  amount: "",
  frequency: "MONTHLY",
  nextDueDate: "",
  endDate: "",
  accountId: "",
  categoryId: "",
  notes: "",
};

export function RecurringExpensesClient({ householdId, accounts, categories }: RecurringClientProps) {
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  async function loadItems() {
    setIsLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ householdId });
      if (activeFilter === "active") params.set("isActive", "true");
      if (activeFilter === "inactive") params.set("isActive", "false");

      const response = await fetch(`/api/recurring-expenses?${params}`);
      const payload = (await response.json()) as {
        data?: { recurringExpenses: RecurringItem[]; upcomingCount: number };
        error?: string;
      };

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudieron cargar los recurrentes.");
        return;
      }

      if (payload.data) {
        setItems(payload.data.recurringExpenses);
        setUpcomingCount(payload.data.upcomingCount);
      }
    } catch {
      setMessage("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const parsed = formSchema.safeParse({
      ...form,
      accountId: form.accountId || undefined,
      categoryId: form.categoryId || undefined,
      endDate: form.endDate || undefined,
    });

    if (!parsed.success) {
      const nextErrors: FormErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string") nextErrors[field as keyof FormState] = issue.message;
      });
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      const url = editingId ? `/api/recurring-expenses/${editingId}` : "/api/recurring-expenses";
      const response = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId,
          name: parsed.data.name,
          currency: parsed.data.currency,
          amount: parsed.data.amount,
          frequency: parsed.data.frequency,
          nextDueDate: parsed.data.nextDueDate,
          endDate: parsed.data.endDate ?? (editingId ? null : undefined),
          accountId: parsed.data.accountId ?? (editingId ? null : undefined),
          categoryId: parsed.data.categoryId ?? (editingId ? null : undefined),
          notes: parsed.data.notes ?? (editingId ? null : undefined),
        }),
      });

      const payload = (await response.json()) as { error?: string; fieldErrors?: FormErrors };

      if (!response.ok) {
        if (payload.fieldErrors) setErrors(payload.fieldErrors);
        setMessage(payload.error ?? "No se pudo guardar el gasto recurrente.");
        return;
      }

      toast.success(editingId ? "Recurrente actualizado." : "Recurrente creado.");
      resetForm();
      setIsFormOpen(false);
      await loadItems();
    } catch {
      setMessage("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(item: RecurringItem) {
    setTogglingId(item.id);
    try {
      const response = await fetch(`/api/recurring-expenses/${item.id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId, isActive: !item.isActive }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(payload.error ?? "No se pudo cambiar el estado.");
        return;
      }

      toast.success(item.isActive ? "Recurrente pausado." : "Recurrente activado.");
      await loadItems();
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Eliminar este gasto recurrente?")) return;
    setDeletingId(id);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/recurring-expenses/${id}?${new URLSearchParams({ householdId })}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(payload.error ?? "No se pudo eliminar.");
        return;
      }

      toast.success("Recurrente eliminado.");
      if (editingId === id) resetForm();
      await loadItems();
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handlePay(item: RecurringItem) {
    if (!item.account) {
      toast.error("Asigná una cuenta al recurrente antes de registrar el pago.");
      return;
    }
    setPayingId(item.id);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId,
          type: "EXPENSE",
          status: "CONFIRMED",
          accountId: item.account.id,
          categoryId: item.category?.id ?? undefined,
          amount: item.amount,
          currency: item.currency,
          description: item.name,
          occurredAt: today,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(payload.error ?? "No se pudo registrar el pago.");
        return;
      }

      toast.success(`Pago de ${item.name} registrado correctamente.`);
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setPayingId(null);
    }
  }

  function startEditing(item: RecurringItem) {
    setEditingId(item.id);
    setIsFormOpen(true);
    setErrors({});
    setMessage(null);
    setForm({
      name: item.name,
      currency: item.currency,
      amount: String(item.amount),
      frequency: item.frequency,
      nextDueDate: item.nextDueDate.slice(0, 10),
      endDate: item.endDate ? item.endDate.slice(0, 10) : "",
      accountId: item.account?.id ?? "",
      categoryId: item.category?.id ?? "",
      notes: item.notes ?? "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setErrors({});
    setForm(defaultForm);
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <AppFormPanel isOpen={isFormOpen} onClose={() => setIsFormOpen(false)}>
        <CardHeader className={appFormHeaderClass()}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>{editingId ? "Editar recurrente" : "Nuevo recurrente"}</CardTitle>
              <CardDescription>
                {editingId ? "Modificá los datos." : "Suscripción, servicio o pago periódico."}
              </CardDescription>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Cerrar formulario" className="ml-auto xl:hidden" onClick={() => setIsFormOpen(false)}>
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className={appFormContentClass(isFormOpen)}>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="Nombre" error={errors.name}>
              <Input value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Ej: Netflix, Alquiler, Gym" />
            </Field>

            <div className="grid gap-3 sm:grid-cols-[96px_1fr]">
              <Field label="Moneda" error={errors.currency}>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.currency} onChange={(e) => updateForm("currency", e.target.value as CurrencyCode)}>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
              <Field label="Monto" error={errors.amount}>
                <Input inputMode="decimal" value={form.amount} onChange={(e) => updateForm("amount", e.target.value)} placeholder="0" />
              </Field>
            </div>

            <Field label="Frecuencia" error={errors.frequency}>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.frequency} onChange={(e) => updateForm("frequency", e.target.value as Frequency)}>
                {frequencies.map((f) => <option key={f} value={f}>{frequencyLabels[f]}</option>)}
              </select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Próximo vencimiento" error={errors.nextDueDate}>
                <Input type="date" value={form.nextDueDate} onChange={(e) => updateForm("nextDueDate", e.target.value)} />
              </Field>
              <Field label="Fecha de fin" error={errors.endDate}>
                <Input type="date" value={form.endDate} onChange={(e) => updateForm("endDate", e.target.value)} />
              </Field>
            </div>

            <Field label="Cuenta" error={errors.accountId}>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.accountId} onChange={(e) => updateForm("accountId", e.target.value)}>
                <option value="">Sin cuenta</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>

            <Field label="Categoría" error={errors.categoryId}>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.categoryId} onChange={(e) => updateForm("categoryId", e.target.value)}>
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>

            <Field label="Notas" error={errors.notes}>
              <textarea className="min-h-16 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} placeholder="Detalle opcional" />
            </Field>

            {message ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null}

            <div className={appFormActionsClass()}>
              <Button className="h-11 w-full" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {editingId ? "Guardar cambios" : "Crear recurrente"}
              </Button>
              {editingId ? (
                <Button type="button" variant="outline" className="h-11 w-full" onClick={resetForm}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </AppFormPanel>

      <div className="space-y-6">
        {/* Summary cards */}
        {!isLoading && (
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[160px] rounded-xl border border-border bg-card px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total mensual activo</p>
              <p className="mt-1 text-[22px] font-extrabold tabular-nums text-foreground">
                {formatMoney(items.filter((i) => i.isActive).reduce((s, i) => s + i.amount, 0), "ARS")}
              </p>
            </div>
            <div className="flex-1 min-w-[140px] rounded-xl border border-rose-500/18 bg-rose-500/8 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-400/70">Vencen pronto</p>
              <p className="mt-1 text-[22px] font-extrabold text-rose-400">{upcomingCount}</p>
            </div>
          </div>
        )}

        {upcomingCount > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
            <Bell className="h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-amber-400">{upcomingCount} vencimiento{upcomingCount > 1 ? "s" : ""}</span> dentro de los próximos 30 días.
            </p>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Gastos recurrentes</CardTitle>
                <CardDescription>{items.length} registrados</CardDescription>
              </div>
              <div className="flex gap-2">
                {(["all", "active", "inactive"] as const).map((f) => (
                  <Button
                    key={f}
                    type="button"
                    variant={activeFilter === f ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveFilter(f)}
                  >
                    {f === "all" ? "Todos" : f === "active" ? "Activos" : "Inactivos"}
                  </Button>
                ))}
                <Button type="button" size="sm" className="hidden xl:inline-flex" onClick={() => { resetForm(); setIsFormOpen(true); }}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Nuevo
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Cargando recurrentes
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Sin gastos recurrentes"
                description="Agregá suscripciones, alquileres o servicios que se repiten periódicamente."
              />
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {items.map((item) => (
                  <RecurringRow
                    key={item.id}
                    item={item}
                    isToggling={togglingId === item.id}
                    isDeleting={deletingId === item.id}
                    isPaying={payingId === item.id}
                    onEdit={() => startEditing(item)}
                    onToggle={() => handleToggle(item)}
                    onDelete={() => handleDelete(item.id)}
                    onPay={() => handlePay(item)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <MobileCreateFab label="Nuevo recurrente" onClick={() => { resetForm(); setIsFormOpen(true); }} />
    </div>
  );
}

function RecurringRow({
  item,
  isToggling,
  isDeleting,
  isPaying,
  onEdit,
  onToggle,
  onDelete,
  onPay,
}: {
  item: RecurringItem;
  isToggling: boolean;
  isDeleting: boolean;
  isPaying: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onPay: () => void;
}) {
  const frequencyLabels: Record<Frequency, string> = {
    WEEKLY: "Semanal",
    BIWEEKLY: "Quincenal",
    MONTHLY: "Mensual",
    QUARTERLY: "Trimestral",
    YEARLY: "Anual",
  };

  return (
    <div className={`grid gap-3 bg-card p-4 xl:grid-cols-[1fr_auto_auto] xl:items-center ${!item.isActive ? "opacity-50" : ""}`}>
      <div className="flex min-w-0 items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.isActive ? "bg-violet-500/15 text-violet-400" : "bg-secondary text-muted-foreground"}`}>
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{item.name}</p>
            <Badge>{frequencyLabels[item.frequency]}</Badge>
            {item.isDueSoon && item.isActive && (
              <Badge className={item.daysUntilDue < 0 ? "border-rose-300 bg-rose-50 text-rose-700" : "border-amber-300 bg-amber-50 text-amber-700"}>
                {item.daysUntilDue < 0
                  ? `Vencido hace ${Math.abs(item.daysUntilDue)}d`
                  : item.daysUntilDue === 0
                  ? "Hoy"
                  : `${item.daysUntilDue}d`}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Vence {formatDate(item.nextDueDate)}
            {item.account ? ` · ${item.account.name}` : ""}
            {item.category ? ` · ${item.category.name}` : ""}
          </p>
          {/* Urgency bar */}
          {item.isActive && (() => {
            const d = item.daysUntilDue;
            const urgColor = d <= 5 ? "#f87171" : d <= 14 ? "#fbbf24" : "hsl(var(--border))";
            const barW = Math.max(5, 100 - (d / 35) * 100);
            const label = d < 0 ? `Vencido hace ${Math.abs(d)}d` : d === 0 ? "Hoy" : d === 1 ? "Mañana" : `en ${d}d`;
            return (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${barW}%`, background: urgColor }} />
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ color: urgColor, background: `${urgColor}18`, border: `1px solid ${urgColor}33` }}>
                  {label}
                </span>
              </div>
            );
          })()}
        </div>
      </div>
      <div className="text-left sm:text-right">
        <p className="text-sm font-semibold text-rose-400">
          -{formatMoney(item.amount, item.currency)}
        </p>
      </div>
      <div className="flex gap-2 xl:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPaying || !item.isActive || !item.account}
          title={!item.account ? "Asigná una cuenta para registrar el pago" : "Registrar pago"}
          onClick={onPay}
        >
          {isPaying ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          )}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={isToggling} onClick={onToggle}>
          {isToggling ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : item.isActive ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={isDeleting} onClick={onDelete}>
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}

function formatMoney(value: number, currency: CurrencyCode) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
