"use client";

import { useState } from "react";
import {
  useRecurringExpenses,
  useCreateRecurring,
  useUpdateRecurring,
  useToggleRecurring,
  useDeleteRecurring,
  usePayRecurring,
} from "@/hooks/use-recurring";
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
import { formatArgentinaDateInput } from "@/lib/dates";
import { onMoneyKeyDown } from "@/lib/input-utils";
import { moneySchema } from "@/lib/money";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
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
  defaultCurrency?: "ARS" | "USD";
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

const defaultForm: Omit<FormState, "nextDueDate" | "currency" | "accountId"> = {
  name: "",
  amount: "",
  frequency: "MONTHLY",
  endDate: "",
  categoryId: "",
  notes: "",
};

const cardMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
} as const;

const inputClass = "v2-focus-ring h-11 rounded-2xl border-border bg-muted/40 text-foreground placeholder:text-muted-foreground";
const selectClass = "v2-focus-ring h-11 w-full rounded-2xl border border-border bg-muted/40 px-4 text-base md:text-sm text-foreground outline-none transition hover:bg-muted/60";

export function RecurringExpensesClient({ householdId, accounts, categories, defaultCurrency = "ARS" }: RecurringClientProps) {
  const defaultAccount = getPreferredArsBankAccount(accounts);
  const getDefaultForm = (): FormState => ({
    ...defaultForm,
    currency: (defaultAccount?.currency ?? defaultCurrency) as CurrencyCode,
    accountId: defaultAccount?.id ?? "",
    nextDueDate: formatArgentinaDateInput(),
  });
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const { data: recurringData, isLoading } = useRecurringExpenses(householdId, activeFilter);
  const items = recurringData?.recurringExpenses ?? [];
  const upcomingCount = recurringData?.upcomingCount ?? 0;

  const createRecurring = useCreateRecurring();
  const updateRecurring = useUpdateRecurring();
  const toggleRecurring = useToggleRecurring();
  const deleteRecurring = useDeleteRecurring();
  const payRecurring = usePayRecurring();

  const isSaving = createRecurring.isPending || updateRecurring.isPending;
  const togglingId = toggleRecurring.isPending ? (toggleRecurring.variables?.id ?? null) : null;
  const deletingId = deleteRecurring.isPending ? (deleteRecurring.variables?.id ?? null) : null;
  const payingId = payRecurring.isPending ? (payRecurring.variables?.item.id ?? null) : null;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(getDefaultForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<RecurringItem | null>(null);

  const summary = buildRecurringSummary(items, upcomingCount);

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

    const input = {
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
    };

    try {
      if (editingId) {
        await updateRecurring.mutateAsync({ id: editingId, ...input });
      } else {
        await createRecurring.mutateAsync(input);
      }
      resetForm();
      setIsFormOpen(false);
    } catch (err: unknown) {
      const e = err as Error & { fieldErrors?: FormErrors };
      if (e.fieldErrors) setErrors(e.fieldErrors);
      setMessage(e.message ?? "No se pudo guardar el gasto recurrente.");
    }
  }

  async function handleToggle(item: RecurringItem) {
    await toggleRecurring.mutateAsync({ id: item.id, householdId, isActive: !item.isActive });
  }

  function requestDelete(item: RecurringItem) {
    setPendingDeleteItem(item);
  }

  async function confirmDelete() {
    if (!pendingDeleteItem) return;
    const id = pendingDeleteItem.id;
    setMessage(null);
    try {
      await deleteRecurring.mutateAsync({ id, householdId });
      setPendingDeleteItem(null);
      if (editingId === id) resetForm();
    } catch {
      // toast shown by hook
    }
  }

  async function handlePay(item: RecurringItem) {
    if (!item.account) {
      toast.error("Asigná una cuenta al recurrente antes de registrar el pago.");
      return;
    }
    await payRecurring.mutateAsync({
      householdId,
      item,
      occurredAt: new Date().toISOString().slice(0, 10),
    });
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
    <div className="grid gap-3 sm:gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <AppFormPanel
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        className="border-border bg-card/80 shadow-[0_24px_80px_rgba(0,0,0,0.32)] xl:rounded-[var(--v2-radius-xl)]"
      >
        <div className={appFormHeaderClass("border-border bg-card/95 xl:bg-transparent")}>
          <div className="flex items-start gap-3 p-5 sm:p-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/50 text-foreground">
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight text-foreground">{editingId ? "Editar gasto fijo" : "Nuevo gasto fijo"}</h2>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
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
              <Input className={inputClass} maxLength={100} value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Ej: Netflix, Alquiler, Gym" />
            </Field>

            <div className="grid gap-3 sm:grid-cols-[104px_1fr]">
              <Field label="Moneda" error={errors.currency}>
                <select className={selectClass} value={form.currency} onChange={(e) => updateForm("currency", e.target.value as CurrencyCode)}>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
              <Field label="Monto" error={errors.amount}>
                <Input className={inputClass} inputMode="decimal" onKeyDown={onMoneyKeyDown} value={form.amount} onChange={(e) => updateForm("amount", e.target.value)} placeholder="0" />
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
              <textarea className="v2-focus-ring min-h-24 w-full resize-none rounded-2xl border border-border bg-muted/40 px-4 py-3 text-base md:text-sm text-foreground outline-none placeholder:text-muted-foreground" maxLength={1000} value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} placeholder="Detalle opcional" />
            </Field>

            {message ? <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-destructive">{message}</p> : null}

            <div className={appFormActionsClass()}>
              <ActionButton className="w-full" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {editingId ? "Guardar cambios" : "Crear gasto fijo"}
              </ActionButton>
              {editingId ? (
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
        <RecurringBriefing summary={summary} isLoading={isLoading} onCreate={openNewItem} />

        {upcomingCount > 0 && (
          <div className="flex items-center gap-3 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4">
            <Bell className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-amber-500">{upcomingCount} vencimiento{upcomingCount > 1 ? "s" : ""}</span> dentro de los próximos 30 días.
            </p>
          </div>
        )}

        <PremiumCard variant="default" className="overflow-hidden">
          <PremiumCardHeader className="pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <PremiumCardTitle>Gastos recurrentes</PremiumCardTitle>
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
                {[1, 2, 3].map((item) => <div key={item} className="h-28 rounded-[1.5rem] border border-border bg-muted/25" />)}
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
              <Skeleton className="h-5 w-40 rounded-full bg-muted" />
              <Skeleton className="h-8 w-80 max-w-full rounded-full bg-muted" />
              <div className="grid gap-3 sm:grid-cols-3">
                {[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 rounded-3xl bg-muted" />)}
              </div>
            </div>
          ) : (
            <>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 text-teal-200" aria-hidden="true" />
                  Costo invisible
                </div>
                <h2 className="text-balance text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
                  {summary.activeCount > 0 ? "Estos gastos ya tienen permiso para volver." : "Todavía no hay gastos automáticos activos."}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  {summary.activeCount > 0
                    ? "Cada gasto queda visible para que sepas exactamente cuánto se compromete el mes."
                    : "Cuando cargues suscripciones y servicios, vas a ver cuánto se va solo cada mes."}
                </p>
              </div>
              <div className="rounded-[2rem] border border-border bg-muted/40 p-4 text-right">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">Activo mensual</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  <SensitiveAmount value={formatMoney(summary.activeMonthly, "ARS")} />
                </p>
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
    <div className="min-w-0 rounded-3xl border border-border bg-muted/30 p-4">
      <p className="text-[11px] font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function RecurringEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-border bg-muted/20 p-4 sm:p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
        <CalendarClock className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">Sin recurrentes por ahora</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Agregá suscripciones, alquileres o servicios para que los próximos pagos aparezcan como señales útiles, no como sorpresas.
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
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-md" initial={shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}>
            <PremiumCard variant="raised">
              <PremiumCardHeader>
                <PremiumCardTitle>Eliminar {item.name}</PremiumCardTitle>
                <PremiumCardDescription>Se quita este gasto fijo. Los pagos ya registrados no se modifican.</PremiumCardDescription>
              </PremiumCardHeader>
              <PremiumCardContent>
                <div className="rounded-3xl border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">Monto recurrente</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
                    <SensitiveAmount value={formatMoney(item.amount, item.currency)} />
                  </p>
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
      className={`rounded-[1.75rem] border border-border bg-muted/25 p-4 transition duration-200 hover:border-border hover:bg-muted/40 sm:p-5 ${!item.isActive ? "opacity-55" : ""}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border ${item.isActive ? "bg-muted/50 text-primary" : "bg-muted/20 text-muted-foreground"}`}>
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-foreground">{item.name}</p>
            <Badge className="border-border bg-muted/50 text-muted-foreground">{frequencyLabels[item.frequency]}</Badge>
            {item.isDueSoon && item.isActive && (
              <Badge className={item.daysUntilDue < 0 ? "border-rose-300/20 bg-rose-400/10 text-destructive" : "border-amber-300/20 bg-amber-300/10 text-amber-500"}>
                {item.daysUntilDue < 0
                  ? `Vencido hace ${Math.abs(item.daysUntilDue)}d`
                  : item.daysUntilDue === 0
                  ? "Hoy"
                  : `${item.daysUntilDue}d`}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
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
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/70">
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
        <p className="text-lg font-semibold tabular-nums text-destructive">
          <SensitiveAmount value={`-${formatMoney(item.amount, item.currency)}`} />
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
      <Label className="text-xs font-semibold uppercase text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
