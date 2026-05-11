"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import { moneySchema } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Frequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
type CurrencyCode = "ARS" | "USD";

type AccountOption = { id: string; name: string; type: string; currency: CurrencyCode };
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

type RecurringSummary = {
  activeMonthly: number;
  activeCount: number;
  inactiveCount: number;
  dueSoonCount: number;
  nextItem: RecurringItem | null;
};

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

const cardMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
} as const;

const inputClass = "v2-focus-ring h-11 rounded-2xl border-white/10 bg-white/[0.05] text-white placeholder:text-zinc-600";
const selectClass = "v2-focus-ring h-11 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm text-white outline-none transition hover:bg-white/[0.07]";

export function RecurringExpensesClient({ householdId, accounts, categories }: RecurringClientProps) {
  const defaultAccount = getPreferredArsBankAccount(accounts);
  const getDefaultForm = (): FormState => ({
    ...defaultForm,
    currency: defaultAccount?.currency ?? "ARS",
    accountId: defaultAccount?.id ?? "",
  });
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(getDefaultForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [pendingDeleteItem, setPendingDeleteItem] = useState<RecurringItem | null>(null);

  const summary = buildRecurringSummary(items, upcomingCount);

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

  function requestDelete(item: RecurringItem) {
    setPendingDeleteItem(item);
  }

  async function confirmDelete() {
    if (!pendingDeleteItem) return;

    const id = pendingDeleteItem.id;
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
      setPendingDeleteItem(null);
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
    setForm(getDefaultForm());
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openNewItem() {
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
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight text-white">{editingId ? "Editar gasto fijo" : "Nuevo gasto fijo"}</h2>
              <p className="mt-1 text-sm leading-5 text-zinc-400">
                {editingId ? "Modificá los datos." : "Suscripción, servicio o pago periódico."}
              </p>
            </div>
            <ActionButton type="button" variant="quiet" size="icon" aria-label="Cerrar formulario" className="ml-auto xl:hidden" onClick={() => setIsFormOpen(false)}>
              <X className="h-5 w-5" aria-hidden="true" />
            </ActionButton>
          </div>
        </div>
        <div className={appFormContentClass(isFormOpen, "px-5 sm:px-6")}>
          <form className="space-y-4 pb-5" onSubmit={handleSubmit}>
            <Field label="Nombre" error={errors.name}>
              <Input className={inputClass} value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Ej: Netflix, Alquiler, Gym" />
            </Field>

            <div className="grid gap-3 sm:grid-cols-[104px_1fr]">
              <Field label="Moneda" error={errors.currency}>
                <select className={selectClass} value={form.currency} onChange={(e) => updateForm("currency", e.target.value as CurrencyCode)}>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
              <Field label="Monto" error={errors.amount}>
                <Input className={inputClass} inputMode="decimal" value={form.amount} onChange={(e) => updateForm("amount", e.target.value)} placeholder="0" />
              </Field>
            </div>

            <Field label="Frecuencia" error={errors.frequency}>
              <select className={selectClass} value={form.frequency} onChange={(e) => updateForm("frequency", e.target.value as Frequency)}>
                {frequencies.map((f) => <option key={f} value={f}>{frequencyLabels[f]}</option>)}
              </select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Próximo vencimiento" error={errors.nextDueDate}>
                <Input className={inputClass} type="date" value={form.nextDueDate} onChange={(e) => updateForm("nextDueDate", e.target.value)} />
              </Field>
              <Field label="Fecha de fin" error={errors.endDate}>
                <Input className={inputClass} type="date" value={form.endDate} onChange={(e) => updateForm("endDate", e.target.value)} />
              </Field>
            </div>

            <Field label="Cuenta" error={errors.accountId}>
              <select className={selectClass} value={form.accountId} onChange={(e) => updateForm("accountId", e.target.value)}>
                <option value="">Sin cuenta</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>

            <Field label="Categoría" error={errors.categoryId}>
              <select className={selectClass} value={form.categoryId} onChange={(e) => updateForm("categoryId", e.target.value)}>
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>

            <Field label="Notas" error={errors.notes}>
              <textarea className="v2-focus-ring min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600" value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} placeholder="Detalle opcional" />
            </Field>

            {message ? <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">{message}</p> : null}

            <div className={appFormActionsClass()}>
              <ActionButton className="w-full" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {editingId ? "Guardar cambios" : "Crear gasto fijo"}
              </ActionButton>
              {editingId ? (
                <ActionButton type="button" variant="glass" className="w-full" onClick={resetForm}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancelar
                </ActionButton>
              ) : null}
            </div>
          </form>
        </div>
      </AppFormPanel>

      <div className="space-y-5">
        <RecurringBriefing summary={summary} isLoading={isLoading} onCreate={openNewItem} />

        {upcomingCount > 0 && (
          <div className="flex items-center gap-3 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4">
            <Bell className="h-5 w-5 shrink-0 text-amber-100" aria-hidden="true" />
            <p className="text-sm text-zinc-300">
              <span className="font-semibold text-amber-100">{upcomingCount} vencimiento{upcomingCount > 1 ? "s" : ""}</span> dentro de los próximos 30 días.
            </p>
          </div>
        )}

        <PremiumCard variant="default" className="overflow-hidden">
          <PremiumCardHeader className="pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <PremiumCardTitle>Pagos silenciosos</PremiumCardTitle>
                <PremiumCardDescription>{items.length} recurrentes registrados</PremiumCardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", "active", "inactive"] as const).map((f) => (
                  <ActionButton
                    key={f}
                    type="button"
                    variant={activeFilter === f ? "primary" : "glass"}
                    size="sm"
                    onClick={() => setActiveFilter(f)}
                  >
                    {f === "all" ? "Todos" : f === "active" ? "Activos" : "Inactivos"}
                  </ActionButton>
                ))}
                <ActionButton type="button" size="sm" className="hidden xl:inline-flex" onClick={openNewItem}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Nuevo
                </ActionButton>
              </div>
            </div>
          </PremiumCardHeader>
          <PremiumCardContent>
            {isLoading ? (
              <div className="grid gap-3">
                {[1, 2, 3].map((item) => <div key={item} className="h-28 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.035]" />)}
              </div>
            ) : items.length === 0 ? (
              <RecurringEmptyState onCreate={openNewItem} />
            ) : (
              <div className="grid gap-3">
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <RecurringRow
                      key={item.id}
                      item={item}
                      isToggling={togglingId === item.id}
                      isDeleting={deletingId === item.id}
                      isPaying={payingId === item.id}
                      onEdit={() => startEditing(item)}
                      onToggle={() => handleToggle(item)}
                      onDelete={() => requestDelete(item)}
                      onPay={() => handlePay(item)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </PremiumCardContent>
        </PremiumCard>
      </div>

      <MobileCreateFab label="Nuevo recurrente" onClick={openNewItem} />
    </div>
    <DeleteRecurringDialog
      item={pendingDeleteItem}
      isDeleting={deletingId === pendingDeleteItem?.id}
      onCancel={() => setPendingDeleteItem(null)}
      onConfirm={confirmDelete}
    />
    </>
  );
}

function RecurringBriefing({ summary, isLoading, onCreate }: { summary: RecurringSummary; isLoading: boolean; onCreate: () => void }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div {...(shouldReduceMotion ? { initial: false } : cardMotion)}>
      <PremiumCard variant="raised" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_18%_0%,rgba(244,114,182,0.14),transparent_36%),radial-gradient(circle_at_82%_0%,rgba(45,212,191,0.13),transparent_34%)]" />
        <PremiumCardContent className="relative p-5 sm:p-6">
          {isLoading ? (
            <div className="space-y-5">
              <Skeleton className="h-5 w-40 rounded-full bg-white/10" />
              <Skeleton className="h-8 w-80 max-w-full rounded-full bg-white/10" />
              <div className="grid gap-3 sm:grid-cols-3">
                {[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 rounded-3xl bg-white/10" />)}
              </div>
            </div>
          ) : (
            <>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-zinc-300">
                  <RefreshCw className="h-3.5 w-3.5 text-teal-200" aria-hidden="true" />
                  Costo invisible
                </div>
                <h2 className="text-balance text-2xl font-semibold leading-tight text-white sm:text-3xl">
                  {summary.activeCount > 0 ? "Estos gastos ya tienen permiso para volver." : "Todavía no hay gastos automáticos activos."}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                  {summary.activeCount > 0
                    ? "La app los mantiene visibles para que el mes no se llene de cobros silenciosos."
                    : "Cuando cargues suscripciones y servicios, vas a ver cuánto se va solo cada mes."}
                </p>
              </div>
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-4 text-right">
                <p className="text-[11px] font-semibold uppercase text-zinc-500">Activo mensual</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{formatMoney(summary.activeMonthly, "ARS")}</p>
                <ActionButton type="button" variant="glass" size="sm" className="mt-3" onClick={onCreate}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Nuevo
                </ActionButton>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <RecurringMetric label="Activos" value={`${summary.activeCount}`} />
              <RecurringMetric label="Vencen pronto" value={`${summary.dueSoonCount}`} />
              <RecurringMetric label="Próximo" value={summary.nextItem ? summary.nextItem.name : "Sin fecha"} />
            </div>
            </>
          )}
        </PremiumCardContent>
      </PremiumCard>
    </motion.div>
  );
}

function RecurringMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-3xl border border-white/[0.08] bg-white/[0.04] p-4">
      <p className="text-[11px] font-medium uppercase text-zinc-500">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function RecurringEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.025] p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-zinc-300">
        <CalendarClock className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-white">Sin gastos fijos invisibles</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-400">
        Agregá suscripciones, alquileres o servicios para revelar cuánto se va solo.
      </p>
      <ActionButton type="button" className="mt-5" onClick={onCreate}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Crear gasto fijo
      </ActionButton>
    </div>
  );
}

function DeleteRecurringDialog({ item, isDeleting, onCancel, onConfirm }: { item: RecurringItem | null; isDeleting: boolean; onCancel: () => void; onConfirm: () => void }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {item ? (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-xl sm:items-center" initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-md" initial={shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}>
            <PremiumCard variant="raised">
              <PremiumCardHeader>
                <PremiumCardTitle>Eliminar {item.name}</PremiumCardTitle>
                <PremiumCardDescription>Se quita este gasto fijo. Los pagos ya registrados no se modifican.</PremiumCardDescription>
              </PremiumCardHeader>
              <PremiumCardContent>
                <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-4">
                  <p className="text-sm text-zinc-400">Monto recurrente</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-white">{formatMoney(item.amount, item.currency)}</p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <ActionButton type="button" variant="glass" onClick={onCancel} disabled={isDeleting}>Cancelar</ActionButton>
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
  const shouldReduceMotion = useReducedMotion();
  const frequencyLabels: Record<Frequency, string> = {
    WEEKLY: "Semanal",
    BIWEEKLY: "Quincenal",
    MONTHLY: "Mensual",
    QUARTERLY: "Trimestral",
    YEARLY: "Anual",
  };

  return (
    <motion.article
      layout
      {...(shouldReduceMotion ? { initial: false } : cardMotion)}
      className={`rounded-[1.75rem] border border-white/[0.08] bg-white/[0.035] p-4 transition duration-200 hover:border-white/[0.16] hover:bg-white/[0.055] sm:p-5 ${!item.isActive ? "opacity-55" : ""}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 ${item.isActive ? "bg-white/[0.06] text-teal-100" : "bg-white/[0.03] text-zinc-500"}`}>
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-white">{item.name}</p>
            <Badge className="border-white/10 bg-white/[0.06] text-zinc-200">{frequencyLabels[item.frequency]}</Badge>
            {item.isDueSoon && item.isActive && (
              <Badge className={item.daysUntilDue < 0 ? "border-rose-300/20 bg-rose-400/10 text-rose-100" : "border-amber-300/20 bg-amber-300/10 text-amber-100"}>
                {item.daysUntilDue < 0
                  ? `Vencido hace ${Math.abs(item.daysUntilDue)}d`
                  : item.daysUntilDue === 0
                  ? "Hoy"
                  : `${item.daysUntilDue}d`}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm leading-5 text-zinc-400">
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
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
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
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-lg font-semibold tabular-nums text-rose-100">
          -{formatMoney(item.amount, item.currency)}
        </p>
        <div className="flex flex-wrap gap-2 sm:justify-end">
        <ActionButton
          type="button"
          variant="glass"
          size="sm"
          disabled={isPaying || !item.isActive || !item.account}
          title={!item.account ? "Asigná una cuenta para registrar el pago" : "Registrar pago"}
          onClick={onPay}
        >
          {isPaying ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-200" aria-hidden="true" />
          )}
        </ActionButton>
        <ActionButton type="button" variant="glass" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </ActionButton>
        <ActionButton type="button" variant="glass" size="sm" disabled={isToggling} onClick={onToggle}>
          {isToggling ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : item.isActive ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
        </ActionButton>
        <ActionButton type="button" variant="danger" size="sm" disabled={isDeleting} onClick={onDelete}>
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
        </ActionButton>
        </div>
      </div>
    </motion.article>
  );
}

function buildRecurringSummary(items: RecurringItem[], upcomingCount: number): RecurringSummary {
  const activeItems = items.filter((item) => item.isActive);

  return {
    activeMonthly: activeItems.reduce((sum, item) => sum + item.amount, 0),
    activeCount: activeItems.length,
    inactiveCount: items.length - activeItems.length,
    dueSoonCount: upcomingCount,
    nextItem:
      activeItems
        .filter((item) => item.nextDueDate)
        .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())[0] ?? null,
  };
}

function formatMoney(value: number, currency: CurrencyCode) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function getPreferredArsBankAccount(accounts: AccountOption[]) {
  return (
    accounts.find((account) => account.currency === "ARS" && account.type === "BANK" && account.name.toLowerCase() === "cuenta bancaria") ??
    accounts.find((account) => account.currency === "ARS" && account.type === "BANK") ??
    accounts.find((account) => account.currency === "ARS") ??
    accounts[0]
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase text-zinc-500">{label}</Label>
      {children}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
