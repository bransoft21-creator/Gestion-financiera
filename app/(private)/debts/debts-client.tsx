"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
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
import {
  AppFormPanel,
  MobileCreateFab,
  appFormActionsClass,
  appFormContentClass,
  appFormHeaderClass,
} from "@/components/app/mobile-form";
import { formatArgentinaDateInput } from "@/lib/dates";
import { onIntegerKeyDown, onMoneyKeyDown } from "@/lib/input-utils";
import { moneySchema, optionalMoneySchema, parseMoneyInput } from "@/lib/money";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DebtType = "LOAN" | "CREDIT_CARD" | "PERSONAL" | "INSTALLMENT" | "OTHER";
type DebtStatus = "ACTIVE" | "PAID" | "PAUSED" | "DEFAULTED" | "CANCELED";
type CurrencyCode = "ARS" | "USD";

type AccountOption = { id: string; name: string; type: string; currency: CurrencyCode };

type DebtItem = {
  id: string;
  name: string;
  lender: string | null;
  type: DebtType;
  status: DebtStatus;
  currency: CurrencyCode;
  originalAmount: number;
  outstandingAmount: number;
  minimumPayment: number | null;
  interestRate: number | null;
  nextDueDate: string | null;
  dueDay: number | null;
  notes: string | null;
  paidPercent: number;
};

type DebtsClientProps = { householdId: string; accounts: AccountOption[] };

type FormState = {
  name: string;
  lender: string;
  type: DebtType;
  status: DebtStatus;
  currency: CurrencyCode;
  originalAmount: string;
  outstandingAmount: string;
  minimumPayment: string;
  interestRate: string;
  nextDueDate: string;
  dueDay: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

type DebtSummary = {
  totalOutstanding: number;
  active: number;
  defaulted: number;
  urgent: number;
  averagePaid: number;
  minimumCommitments: Partial<Record<CurrencyCode, number>>;
  nextDebt: DebtItem | null;
};

const debtTypeLabels: Record<DebtType, string> = {
  LOAN: "Préstamo",
  CREDIT_CARD: "Tarjeta de crédito",
  PERSONAL: "Deuda personal",
  INSTALLMENT: "Cuotas",
  OTHER: "Otro",
};

const debtStatusLabels: Record<DebtStatus, string> = {
  ACTIVE: "Activa",
  PAID: "Pagada",
  PAUSED: "Pausada",
  DEFAULTED: "En mora",
  CANCELED: "Cancelada",
};

const debtTypes = Object.keys(debtTypeLabels) as DebtType[];
const debtStatuses = Object.keys(debtStatusLabels) as DebtStatus[];

const formSchema = z.object({
  name: z.string().trim().min(2, "Ingresá un nombre.").max(100),
  lender: z.string().trim().max(100).optional(),
  type: z.enum(debtTypes as [DebtType, ...DebtType[]]),
  status: z.enum(debtStatuses as [DebtStatus, ...DebtStatus[]]),
  currency: z.enum(["ARS", "USD"]),
  originalAmount: moneySchema(),
  outstandingAmount: moneySchema(),
  minimumPayment: optionalMoneySchema(),
  interestRate: z.coerce.number().nonnegative().max(999).optional(),
  nextDueDate: z.string().optional(),
  dueDay: z.coerce.number().int().min(1).max(31).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const defaultForm: FormState = {
  name: "",
  lender: "",
  type: "LOAN",
  status: "ACTIVE",
  currency: "ARS",
  originalAmount: "",
  outstandingAmount: "",
  minimumPayment: "",
  interestRate: "",
  nextDueDate: "",
  dueDay: "",
  notes: "",
};

const cardMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
} as const;

export function DebtsClient({ householdId, accounts }: DebtsClientProps) {
  const defaultAccount = getPreferredArsBankAccount(accounts);
  const [todayMs] = useState(() => Date.now());
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingDebtId, setDeletingDebtId] = useState<string | null>(null);
  const [pendingDeleteDebt, setPendingDeleteDebt] = useState<DebtItem | null>(null);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [payingDebtId, setPayingDebtId] = useState<string | null>(null);
  const [quickPayDebtId, setQuickPayDebtId] = useState<string | null>(null);
  const [quickPayAccountId, setQuickPayAccountId] = useState<string>("");
  const [quickPayAmount, setQuickPayAmount] = useState<string>("");
  const [quickPayErrors, setQuickPayErrors] = useState<{ accountId?: string; amount?: string; debtId?: string }>({});

  const summary = useMemo(() => buildDebtSummary(debts, totalOutstanding, todayMs), [debts, totalOutstanding, todayMs]);

  useEffect(() => {
    void loadDebts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function loadDebts() {
    setIsLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ householdId });
      if (statusFilter) params.set("status", statusFilter);
      const response = await fetch(`/api/debts?${params}`);
      const payload = (await response.json()) as {
        data?: { debts: DebtItem[]; totalOutstanding: number };
        error?: string;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "No se pudieron cargar las deudas.");
        return;
      }

      if (payload.data) {
        setDebts(payload.data.debts);
        setTotalOutstanding(payload.data.totalOutstanding);
      }
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const parsed = formSchema.safeParse({
      ...form,
      lender: form.lender || undefined,
      minimumPayment: form.minimumPayment || undefined,
      interestRate: form.interestRate || undefined,
      nextDueDate: form.nextDueDate || undefined,
      dueDay: form.dueDay || undefined,
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
      const url = editingDebtId ? `/api/debts/${editingDebtId}` : "/api/debts";
      const response = await fetch(url, {
        method: editingDebtId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId,
          ...parsed.data,
          nextDueDate: parsed.data.nextDueDate || (editingDebtId ? null : undefined),
          lender: parsed.data.lender || (editingDebtId ? null : undefined),
          minimumPayment: parsed.data.minimumPayment ?? (editingDebtId ? null : undefined),
          interestRate: parsed.data.interestRate ?? (editingDebtId ? null : undefined),
        }),
      });

      const payload = (await response.json()) as { error?: string; fieldErrors?: FormErrors };

      if (!response.ok) {
        if (payload.fieldErrors) setErrors(payload.fieldErrors);
        setMessage(payload.error ?? "No se pudo guardar la deuda.");
        return;
      }

      toast.success(editingDebtId ? "Compromiso actualizado." : "Compromiso registrado.");
      resetForm();
      setIsFormOpen(false);
      await loadDebts();
    } catch {
      setMessage("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  function requestDelete(debt: DebtItem) {
    setPendingDeleteDebt(debt);
  }

  async function confirmDelete() {
    if (!pendingDeleteDebt) return;

    const debtId = pendingDeleteDebt.id;
    setDeletingDebtId(debtId);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/debts/${debtId}?${new URLSearchParams({ householdId })}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(payload.error ?? "No se pudo eliminar la deuda.");
        return;
      }

      toast.success("Compromiso eliminado.");
      setPendingDeleteDebt(null);
      if (editingDebtId === debtId) resetForm();
      await loadDebts();
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setDeletingDebtId(null);
    }
  }

  function openQuickPay(debt: DebtItem) {
    setQuickPayDebtId(debt.id);
    setQuickPayAccountId(defaultAccount?.id ?? "");
    setQuickPayAmount(String(debt.minimumPayment ?? debt.outstandingAmount));
    setQuickPayErrors({});
  }

  function cancelQuickPay() {
    setQuickPayDebtId(null);
    setQuickPayAccountId("");
    setQuickPayAmount("");
    setQuickPayErrors({});
  }

  async function handlePayConfirm(debt: DebtItem) {
    if (!quickPayAccountId) {
      setQuickPayErrors({ accountId: "Seleccioná una cuenta para registrar el pago." });
      return;
    }
    const parsedAmount = parseMoneyInput(quickPayAmount);
    if (!parsedAmount.success || parsedAmount.data == null) {
      setQuickPayErrors({ amount: parsedAmount.success ? "Ingresá un monto." : parsedAmount.error });
      return;
    }
    if (parsedAmount.data > debt.outstandingAmount) {
      setQuickPayErrors({ amount: `El pago no puede superar el saldo pendiente (${formatMoney(debt.outstandingAmount, debt.currency)}).` });
      return;
    }

    setQuickPayErrors({});
    setPayingDebtId(debt.id);
    try {
      const today = formatArgentinaDateInput();
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId,
          type: "DEBT_PAYMENT",
          status: "CONFIRMED",
          accountId: quickPayAccountId,
          debtId: debt.id,
          amount: parsedAmount.data,
          currency: debt.currency,
          description: `Pago: ${debt.name}`,
          occurredAt: today,
        }),
      });

      const payload = (await response.json()) as { error?: string; fieldErrors?: { accountId?: string; amount?: string; debtId?: string } };
      if (!response.ok) {
        if (payload.fieldErrors) setQuickPayErrors(payload.fieldErrors);
        toast.error(payload.error ?? "No se pudo registrar el pago.");
        return;
      }

      toast.success(`Pago de ${debt.name} registrado correctamente.`);
      cancelQuickPay();
      await loadDebts();
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setPayingDebtId(null);
    }
  }

  function startEditing(debt: DebtItem) {
    setEditingDebtId(debt.id);
    setIsFormOpen(true);
    setErrors({});
    setMessage(null);
    setForm({
      name: debt.name,
      lender: debt.lender ?? "",
      type: debt.type,
      status: debt.status,
      currency: debt.currency,
      originalAmount: String(debt.originalAmount),
      outstandingAmount: String(debt.outstandingAmount),
      minimumPayment: debt.minimumPayment != null ? String(debt.minimumPayment) : "",
      interestRate: debt.interestRate != null ? String(debt.interestRate) : "",
      nextDueDate: debt.nextDueDate ? debt.nextDueDate.slice(0, 10) : "",
      dueDay: debt.dueDay ? String(debt.dueDay) : "",
      notes: debt.notes ?? "",
    });
  }

  function resetForm() {
    setEditingDebtId(null);
    setErrors({});
    setForm(defaultForm);
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openNewDebt() {
    resetForm();
    setIsFormOpen(true);
  }

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <AppFormPanel
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          className="border-white/10 bg-zinc-950/80 shadow-[0_24px_80px_rgba(0,0,0,0.32)] xl:rounded-[var(--v2-radius-xl)]"
        >
          <div className={appFormHeaderClass("border-white/10 bg-zinc-950/95 xl:bg-transparent")}>
            <div className="flex items-start gap-3 p-5 sm:p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white">
                <CreditCard className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-tight text-white">
                  {editingDebtId ? "Ajustar compromiso" : "Nuevo compromiso"}
                </h2>
                <p className="mt-1 text-sm leading-5 text-zinc-400">
                  {editingDebtId ? "Actualizá saldo, vencimiento y estado." : "Registrá préstamo, tarjeta o cuota."}
                </p>
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
                <Input className={inputClass} maxLength={100} value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Ej: Préstamo personal banco" />
              </Field>

              <Field label="Acreedor / entidad" error={errors.lender}>
                <Input className={inputClass} maxLength={100} value={form.lender} onChange={(e) => updateForm("lender", e.target.value)} placeholder="Opcional" />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tipo" error={errors.type}>
                  <select className={selectClass} value={form.type} onChange={(e) => updateForm("type", e.target.value as DebtType)}>
                    {debtTypes.map((type) => <option key={type} value={type}>{debtTypeLabels[type]}</option>)}
                  </select>
                </Field>
                <Field label="Estado" error={errors.status}>
                  <select className={selectClass} value={form.status} onChange={(e) => updateForm("status", e.target.value as DebtStatus)}>
                    {debtStatuses.map((status) => <option key={status} value={status}>{debtStatusLabels[status]}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Moneda" error={errors.currency}>
                <select className={selectClass} value={form.currency} onChange={(e) => updateForm("currency", e.target.value as CurrencyCode)}>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Monto original" error={errors.originalAmount}>
                  <Input className={inputClass} inputMode="decimal" onKeyDown={onMoneyKeyDown} value={form.originalAmount} onChange={(e) => updateForm("originalAmount", e.target.value)} placeholder="0" />
                </Field>
                <Field label="Saldo pendiente" error={errors.outstandingAmount}>
                  <Input className={inputClass} inputMode="decimal" onKeyDown={onMoneyKeyDown} value={form.outstandingAmount} onChange={(e) => updateForm("outstandingAmount", e.target.value)} placeholder="0" />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Pago mínimo" error={errors.minimumPayment}>
                  <Input className={inputClass} inputMode="decimal" onKeyDown={onMoneyKeyDown} value={form.minimumPayment} onChange={(e) => updateForm("minimumPayment", e.target.value)} placeholder="Opcional" />
                </Field>
                <Field label="Tasa de interés (%)" error={errors.interestRate}>
                  <Input className={inputClass} inputMode="decimal" onKeyDown={onMoneyKeyDown} value={form.interestRate} onChange={(e) => updateForm("interestRate", e.target.value)} placeholder="Opcional" />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Próximo vencimiento" error={errors.nextDueDate}>
                  <Input className={inputClass} type="date" value={form.nextDueDate} onChange={(e) => updateForm("nextDueDate", e.target.value)} />
                </Field>
                <Field label="Día de vencimiento" error={errors.dueDay}>
                  <Input className={inputClass} inputMode="numeric" onKeyDown={onIntegerKeyDown} value={form.dueDay} onChange={(e) => updateForm("dueDay", e.target.value)} placeholder="Ej: 15" />
                </Field>
              </div>

              <Field label="Notas" error={errors.notes}>
                <textarea className="v2-focus-ring min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-base md:text-sm text-white outline-none placeholder:text-zinc-600" maxLength={1000} value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} placeholder="Detalle opcional" />
              </Field>

              {message ? (
                <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">
                  {message}
                </p>
              ) : null}

              <div className={appFormActionsClass()}>
                <ActionButton className="w-full" disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  {editingDebtId ? "Guardar cambios" : "Registrar"}
                </ActionButton>
                {editingDebtId ? (
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
          <DebtBriefing summary={summary} debtCount={debts.length} isLoading={isLoading} onCreate={openNewDebt} />

          <PremiumCard variant="default" className="overflow-hidden">
            <PremiumCardHeader className="pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <PremiumCardTitle>Compromisos activos</PremiumCardTitle>
                  <PremiumCardDescription>Saldo pendiente, vencimientos y próximos pagos.</PremiumCardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="v2-focus-ring h-9 rounded-2xl border border-white/10 bg-white/[0.05] px-3 text-base md:text-sm text-white outline-none"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {debtStatuses.map((status) => <option key={status} value={status}>{debtStatusLabels[status]}</option>)}
                  </select>
                  <ActionButton type="button" size="sm" className="hidden xl:inline-flex" onClick={openNewDebt}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Nuevo
                  </ActionButton>
                </div>
              </div>
            </PremiumCardHeader>
            <PremiumCardContent>
              {isLoading ? (
                <DebtSkeletonList />
              ) : debts.length === 0 ? (
                <DebtEmptyState onCreate={openNewDebt} />
              ) : (
                <div className="grid gap-3">
                  <AnimatePresence initial={false}>
                    {debts.map((debt) => (
                      <DebtCard
                        key={debt.id}
                        debt={debt}
                        todayMs={todayMs}
                        accounts={accounts}
                        isDeleting={deletingDebtId === debt.id}
                        isPaying={payingDebtId === debt.id}
                        isQuickPayOpen={quickPayDebtId === debt.id}
                        quickPayAccountId={quickPayAccountId}
                        quickPayAmount={quickPayAmount}
                        quickPayErrors={quickPayErrors}
                        onEdit={() => startEditing(debt)}
                        onDelete={() => requestDelete(debt)}
                        onQuickPayOpen={() => openQuickPay(debt)}
                        onQuickPayCancel={cancelQuickPay}
                        onQuickPayAccountChange={setQuickPayAccountId}
                        onQuickPayAmountChange={setQuickPayAmount}
                        onQuickPayConfirm={() => handlePayConfirm(debt)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </PremiumCardContent>
          </PremiumCard>
        </div>

        <MobileCreateFab label="Nueva deuda" onClick={openNewDebt} />
      </div>

      <DeleteDebtDialog
        debt={pendingDeleteDebt}
        isDeleting={deletingDebtId === pendingDeleteDebt?.id}
        onCancel={() => setPendingDeleteDebt(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

const inputClass = "v2-focus-ring h-11 rounded-2xl border-white/10 bg-white/[0.05] text-white placeholder:text-zinc-600";
const selectClass = "v2-focus-ring h-11 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-base md:text-sm text-white outline-none transition hover:bg-white/[0.07]";

function DebtBriefing({
  summary,
  debtCount,
  isLoading,
  onCreate,
}: {
  summary: DebtSummary;
  debtCount: number;
  isLoading: boolean;
  onCreate: () => void;
}) {
  const state = getDebtState(summary, debtCount);
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div {...(shouldReduceMotion ? { initial: false } : cardMotion)}>
      <PremiumCard variant="raised" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_18%_0%,rgba(251,113,133,0.16),transparent_36%),radial-gradient(circle_at_82%_0%,rgba(251,191,36,0.13),transparent_34%)]" />
        <PremiumCardContent className="relative p-5 sm:p-6">
          {isLoading ? (
            <div className="space-y-5">
              <Skeleton className="h-5 w-40 rounded-full bg-white/10" />
              <Skeleton className="h-8 w-80 max-w-full rounded-full bg-white/10" />
              <Skeleton className="h-3 w-full rounded-full bg-white/10" />
              <div className="grid gap-3 sm:grid-cols-3">
                {[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 rounded-3xl bg-white/10" />)}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-zinc-300">
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-200" aria-hidden="true" />
                    Radar de compromisos
                  </div>
                  <h2 className="text-balance text-2xl font-semibold leading-tight text-white sm:text-3xl">
                    {state.title}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">{state.description}</p>
                </div>
                <div className="rounded-[2rem] border border-rose-300/20 bg-rose-400/10 p-4 text-right shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <p className="text-[11px] font-semibold uppercase text-rose-100/70">Saldo pendiente</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                    {formatMoney(summary.totalOutstanding, "ARS")}
                  </p>
                  <ActionButton type="button" variant="glass" size="sm" className="mt-3" onClick={onCreate}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Nuevo
                  </ActionButton>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <DebtBriefMetric icon={WalletCards} label="Pago mínimo" value={formatCommitments(summary.minimumCommitments)} />
                <DebtBriefMetric icon={CalendarClock} label="Urgentes" value={`${summary.urgent}`} />
                <DebtBriefMetric
                  icon={Landmark}
                  label="Próximo vencimiento"
                  value={summary.nextDebt?.nextDueDate ? formatDate(summary.nextDebt.nextDueDate) : "Sin fecha"}
                />
              </div>
            </>
          )}
        </PremiumCardContent>
      </PremiumCard>
    </motion.div>
  );
}

function DebtBriefMetric({
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

function DebtCard({
  debt,
  todayMs,
  accounts,
  isDeleting,
  isPaying,
  isQuickPayOpen,
  quickPayAccountId,
  quickPayAmount,
  quickPayErrors,
  onEdit,
  onDelete,
  onQuickPayOpen,
  onQuickPayCancel,
  onQuickPayAccountChange,
  onQuickPayAmountChange,
  onQuickPayConfirm,
}: {
  debt: DebtItem;
  todayMs: number;
  accounts: AccountOption[];
  isDeleting: boolean;
  isPaying: boolean;
  isQuickPayOpen: boolean;
  quickPayAccountId: string;
  quickPayAmount: string;
  quickPayErrors: { accountId?: string; amount?: string; debtId?: string };
  onEdit: () => void;
  onDelete: () => void;
  onQuickPayOpen: () => void;
  onQuickPayCancel: () => void;
  onQuickPayAccountChange: (value: string) => void;
  onQuickPayAmountChange: (value: string) => void;
  onQuickPayConfirm: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [displayWidth, setDisplayWidth] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    const timer = setTimeout(() => setDisplayWidth(Math.min(debt.paidPercent, 100)), 120);
    return () => clearTimeout(timer);
  }, [debt.paidPercent]);

  const daysUntil = debt.nextDueDate
    ? Math.round((new Date(debt.nextDueDate).getTime() - todayMs) / 86400000)
    : null;
  const urgent = daysUntil !== null && daysUntil <= 7 && debt.status === "ACTIVE";
  const canPay = debt.status === "ACTIVE" && accounts.length > 0;

  return (
    <motion.article
      layout
      {...(shouldReduceMotion ? { initial: false } : cardMotion)}
      className={`rounded-[1.75rem] border bg-white/[0.035] p-4 transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.055] sm:p-5 ${
        urgent ? "border-rose-300/25 shadow-[0_18px_55px_rgba(244,63,94,0.08)]" : "border-white/[0.08]"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-white">{debt.name}</p>
            <Badge className={getDebtStatusClass(debt.status)}>{debtStatusLabels[debt.status]}</Badge>
          </div>
          {debt.lender ? <p className="mt-1 text-sm text-zinc-400">{debt.lender}</p> : null}
          <p className="mt-1 text-xs text-zinc-500">
            {debtTypeLabels[debt.type]} · {debt.currency}
            {debt.interestRate != null ? ` · ${debt.interestRate}% TNA` : ""}
          </p>
          {daysUntil !== null ? (
            <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
              urgent
                ? "border-rose-300/25 bg-rose-400/10 text-rose-100"
                : "border-white/10 bg-white/[0.04] text-zinc-300"
            }`}>
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {daysUntil === 0 ? "Vence hoy" : daysUntil < 0 ? `Venció hace ${-daysUntil}d` : `Vence en ${daysUntil}d`}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-xl font-semibold tabular-nums text-rose-100">{formatMoney(debt.outstandingAmount, debt.currency)}</p>
          <p className="text-xs text-zinc-500">de {formatMoney(debt.originalAmount, debt.currency)}</p>
          {debt.minimumPayment ? <p className="text-xs text-zinc-400">Mín: {formatMoney(debt.minimumPayment, debt.currency)}</p> : null}
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-teal-300 to-lime-200 transition-[width] duration-700 ease-out"
          style={{ width: `${displayWidth}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500">{debt.paidPercent.toFixed(0)}% pagado</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {canPay ? (
          <ActionButton
            type="button"
            variant="glass"
            size="sm"
            disabled={isPaying}
            onClick={isQuickPayOpen ? onQuickPayCancel : onQuickPayOpen}
          >
            {isPaying ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-200" aria-hidden="true" />
            )}
            Registrar pago
          </ActionButton>
        ) : null}
        <ActionButton type="button" variant="glass" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Editar
        </ActionButton>
        <ActionButton type="button" variant="danger" size="sm" disabled={isDeleting} onClick={onDelete}>
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
          Eliminar
        </ActionButton>
      </div>

      <AnimatePresence initial={false}>
        {isQuickPayOpen ? (
          <motion.div {...(shouldReduceMotion ? { initial: false } : cardMotion)} className="mt-4 space-y-3 rounded-[1.5rem] border border-emerald-300/20 bg-emerald-300/10 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-100">Registrar pago</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Cuenta</label>
                <select
                  className="v2-focus-ring h-10 w-full rounded-2xl border border-white/10 bg-zinc-950/70 px-3 text-base md:text-sm text-white outline-none"
                  value={quickPayAccountId}
                  onChange={(e) => onQuickPayAccountChange(e.target.value)}
                >
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
                {quickPayErrors.accountId ? <p className="text-xs text-rose-200">{quickPayErrors.accountId}</p> : null}
                {quickPayErrors.debtId ? <p className="text-xs text-rose-200">{quickPayErrors.debtId}</p> : null}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Monto ({debt.currency})</label>
                <Input
                  inputMode="decimal"
                  onKeyDown={onMoneyKeyDown}
                  value={quickPayAmount}
                  onChange={(e) => onQuickPayAmountChange(e.target.value)}
                  placeholder="0"
                  className="v2-focus-ring h-10 rounded-2xl border-white/10 bg-zinc-950/70 text-white placeholder:text-zinc-600"
                />
                {quickPayErrors.amount ? <p className="text-xs text-rose-200">{quickPayErrors.amount}</p> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton type="button" size="sm" disabled={isPaying} onClick={onQuickPayConfirm}>
                {isPaying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                Confirmar
              </ActionButton>
              <ActionButton type="button" variant="quiet" size="sm" onClick={onQuickPayCancel}>
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

function DebtSkeletonList() {
  return (
    <div className="grid gap-3">
      {[0, 1].map((item) => (
        <div key={item} className="space-y-4 rounded-[1.75rem] border border-white/[0.08] bg-white/[0.035] p-4">
          <div className="flex justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40 bg-white/10" />
              <Skeleton className="h-3 w-56 max-w-full bg-white/10" />
              <Skeleton className="h-6 w-28 rounded-full bg-white/10" />
            </div>
            <Skeleton className="h-12 w-24 rounded-2xl bg-white/10" />
          </div>
          <Skeleton className="h-2 w-full rounded-full bg-white/10" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-xl bg-white/10" />
            <Skeleton className="h-9 w-20 rounded-xl bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DebtEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.025] p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-zinc-300">
        <CreditCard className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-white">Sin compromisos registrados</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-400">
        Registrá préstamos, tarjetas o cuotas para ver qué pesa sobre tu mes.
      </p>
      <ActionButton type="button" className="mt-5" onClick={onCreate}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Crear compromiso
      </ActionButton>
    </div>
  );
}

function DeleteDebtDialog({
  debt,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  debt: DebtItem | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {debt ? (
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
                    <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <PremiumCardTitle>Eliminar {debt.name}</PremiumCardTitle>
                    <PremiumCardDescription>
                      Se quita este compromiso. Los pagos ya registrados no se modifican.
                    </PremiumCardDescription>
                  </div>
                </div>
              </PremiumCardHeader>
              <PremiumCardContent>
                <div className="rounded-3xl border border-white/[0.08] bg-white/[0.04] p-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-300">
                    <CreditCard className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                    Saldo pendiente
                  </div>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-white">
                    {formatMoney(debt.outstandingAmount, debt.currency)}
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

function buildDebtSummary(debts: DebtItem[], totalOutstanding: number, todayMs: number): DebtSummary {
  const activeDebts = debts.filter((debt) => debt.status === "ACTIVE");
  const nextDebt =
    activeDebts
      .filter((debt) => debt.nextDueDate)
      .sort((a, b) => new Date(a.nextDueDate ?? "").getTime() - new Date(b.nextDueDate ?? "").getTime())[0] ?? null;
  const urgent = activeDebts.filter((debt) => {
    if (!debt.nextDueDate) return false;
    const daysUntil = Math.round((new Date(debt.nextDueDate).getTime() - todayMs) / 86400000);
    return daysUntil <= 7;
  }).length;

  return {
    totalOutstanding,
    active: activeDebts.length,
    defaulted: debts.filter((debt) => debt.status === "DEFAULTED").length,
    urgent,
    averagePaid: debts.length > 0 ? Math.round(debts.reduce((sum, debt) => sum + Math.min(debt.paidPercent, 100), 0) / debts.length) : 0,
    minimumCommitments: activeDebts.reduce<Partial<Record<CurrencyCode, number>>>((acc, debt) => {
      if (debt.minimumPayment != null) {
        acc[debt.currency] = (acc[debt.currency] ?? 0) + debt.minimumPayment;
      }
      return acc;
    }, {}),
    nextDebt,
  };
}

function getDebtState(summary: DebtSummary, debtCount: number) {
  if (debtCount === 0) {
    return {
      title: "No hay carga financiera visible.",
      description: "Cuando registres una deuda, el sistema va a ordenar saldo, vencimiento y próximo pago en un solo lugar.",
    };
  }

  if (summary.defaulted > 0) {
    return {
      title: "Hay compromisos que necesitan atención hoy.",
      description: "Tenés deuda en mora. Conviene priorizar contacto, pago mínimo o reordenamiento antes de sumar nuevos gastos.",
    };
  }

  if (summary.urgent > 0) {
    return {
      title: "Tu semana tiene vencimientos cerca.",
      description: `${summary.urgent} ${summary.urgent === 1 ? "compromiso vence" : "compromisos vencen"} en los próximos días. Dejarlo visible evita sorpresas.`,
    };
  }

  if (summary.averagePaid >= 70) {
    return {
      title: "La carga viene bajando con buen ritmo.",
      description: "El progreso de pago ya es alto. Mantener pagos mínimos y cierres parciales puede liberar margen pronto.",
    };
  }

  return {
    title: "Tus compromisos ya están bajo control visual.",
    description: "La app sigue saldo, vencimientos y pagos mínimos para que sepas qué pesa realmente sobre el mes.",
  };
}

function formatCommitments(commitments: Partial<Record<CurrencyCode, number>>) {
  const parts = (["ARS", "USD"] as CurrencyCode[])
    .filter((currency) => (commitments[currency] ?? 0) > 0)
    .map((currency) => formatMoney(commitments[currency] ?? 0, currency));

  return parts.length > 0 ? parts.join(" + ") : "Sin mínimo";
}

function getDebtStatusClass(status: DebtStatus) {
  if (status === "ACTIVE") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  if (status === "PAID") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (status === "PAUSED") return "border-sky-300/20 bg-sky-300/10 text-sky-100";
  if (status === "DEFAULTED") return "border-rose-300/20 bg-rose-400/10 text-rose-100";
  return "border-zinc-300/10 bg-zinc-300/10 text-zinc-300";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatMoney(value: number, currency: CurrencyCode) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
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
