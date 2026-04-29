"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CreditCard, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { EmptyState } from "@/components/app/empty-state";
import {
  AppFormPanel,
  MobileCreateFab,
  appFormActionsClass,
  appFormContentClass,
} from "@/components/app/mobile-form";
import { formatArgentinaDateInput } from "@/lib/dates";
import { moneySchema, optionalMoneySchema, parseMoneyInput } from "@/lib/money";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DebtType = "LOAN" | "CREDIT_CARD" | "PERSONAL" | "INSTALLMENT" | "OTHER";
type DebtStatus = "ACTIVE" | "PAID" | "PAUSED" | "DEFAULTED" | "CANCELED";
type CurrencyCode = "ARS" | "USD";

type AccountOption = { id: string; name: string };

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

export function DebtsClient({ householdId, accounts }: DebtsClientProps) {
  const [todayMs] = useState(() => Date.now());
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingDebtId, setDeletingDebtId] = useState<string | null>(null);
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

      toast.success(editingDebtId ? "Deuda actualizada." : "Deuda registrada.");
      resetForm();
      setIsFormOpen(false);
      await loadDebts();
    } catch {
      setMessage("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(debtId: string) {
    if (!window.confirm("¿Eliminar esta deuda? Se aplicará soft delete.")) return;
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

      toast.success("Deuda eliminada.");
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
    setQuickPayAccountId(accounts[0]?.id ?? "");
    setQuickPayAmount(
      String(debt.minimumPayment ?? debt.outstandingAmount),
    );
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

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <AppFormPanel isOpen={isFormOpen} onClose={() => setIsFormOpen(false)}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>{editingDebtId ? "Editar deuda" : "Nueva deuda"}</CardTitle>
              <CardDescription>
                {editingDebtId ? "Modificá los datos de la deuda." : "Registrá un préstamo, tarjeta o cuota."}
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
              <Input value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Ej: Préstamo personal banco" />
            </Field>

            <Field label="Acreedor / entidad" error={errors.lender}>
              <Input value={form.lender} onChange={(e) => updateForm("lender", e.target.value)} placeholder="Opcional" />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo" error={errors.type}>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.type} onChange={(e) => updateForm("type", e.target.value as DebtType)}>
                  {debtTypes.map((t) => <option key={t} value={t}>{debtTypeLabels[t]}</option>)}
                </select>
              </Field>
              <Field label="Estado" error={errors.status}>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.status} onChange={(e) => updateForm("status", e.target.value as DebtStatus)}>
                  {debtStatuses.map((s) => <option key={s} value={s}>{debtStatusLabels[s]}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Moneda" error={errors.currency}>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.currency} onChange={(e) => updateForm("currency", e.target.value as CurrencyCode)}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Monto original" error={errors.originalAmount}>
                <Input inputMode="decimal" value={form.originalAmount} onChange={(e) => updateForm("originalAmount", e.target.value)} placeholder="0" />
              </Field>
              <Field label="Saldo pendiente" error={errors.outstandingAmount}>
                <Input inputMode="decimal" value={form.outstandingAmount} onChange={(e) => updateForm("outstandingAmount", e.target.value)} placeholder="0" />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pago mínimo" error={errors.minimumPayment}>
                <Input inputMode="decimal" value={form.minimumPayment} onChange={(e) => updateForm("minimumPayment", e.target.value)} placeholder="Opcional" />
              </Field>
              <Field label="Tasa de interés (%)" error={errors.interestRate}>
                <Input inputMode="decimal" value={form.interestRate} onChange={(e) => updateForm("interestRate", e.target.value)} placeholder="Opcional" />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Próximo vencimiento" error={errors.nextDueDate}>
                <Input type="date" value={form.nextDueDate} onChange={(e) => updateForm("nextDueDate", e.target.value)} />
              </Field>
              <Field label="Día de vencimiento" error={errors.dueDay}>
                <Input inputMode="numeric" value={form.dueDay} onChange={(e) => updateForm("dueDay", e.target.value)} placeholder="Ej: 15" />
              </Field>
            </div>

            <Field label="Notas" error={errors.notes}>
              <textarea className="min-h-16 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} placeholder="Detalle opcional" />
            </Field>

            {message ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null}

            <div className={appFormActionsClass()}>
              <Button className="h-11 w-full" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {editingDebtId ? "Guardar cambios" : "Registrar deuda"}
              </Button>
              {editingDebtId ? (
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
        <div className="grid gap-3 sm:grid-cols-2">
          {isLoading ? (
            <>
              <Skeleton className="h-[80px] rounded-xl" />
              <Skeleton className="h-[80px] rounded-xl" />
            </>
          ) : (
            <>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Deuda activa total</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-rose-400">{formatMoney(totalOutstanding, "ARS")}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Deudas registradas</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{debts.length}</p>
              </div>
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Listado de deudas</CardTitle>
                <CardDescription>Saldo pendiente y progreso de pago.</CardDescription>
              </div>
              <div className="flex gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">Todos los estados</option>
                  {debtStatuses.map((s) => <option key={s} value={s}>{debtStatusLabels[s]}</option>)}
                </select>
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
                {[0, 1].map((i) => <Skeleton key={i} className="h-[148px] rounded-xl" />)}
              </div>
            ) : debts.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="Sin deudas registradas"
                description="Registrá préstamos, tarjetas o cuotas para llevar el control de lo que debés."
              />
            ) : (
              <div className="grid gap-3">
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
                    onDelete={() => handleDelete(debt.id)}
                    onQuickPayOpen={() => openQuickPay(debt)}
                    onQuickPayCancel={cancelQuickPay}
                    onQuickPayAccountChange={setQuickPayAccountId}
                    onQuickPayAmountChange={setQuickPayAmount}
                    onQuickPayConfirm={() => handlePayConfirm(debt)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <MobileCreateFab label="Nueva deuda" onClick={() => { resetForm(); setIsFormOpen(true); }} />
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
  onQuickPayAccountChange: (v: string) => void;
  onQuickPayAmountChange: (v: string) => void;
  onQuickPayConfirm: () => void;
}) {
  const [displayWidth, setDisplayWidth] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    const t = setTimeout(() => setDisplayWidth(debt.paidPercent), 120);
    return () => clearTimeout(t);
  }, [debt.paidPercent]);

  const statusColors: Record<DebtStatus, string> = {
    ACTIVE: "border-amber-300 bg-amber-50 text-amber-700",
    PAID: "border-emerald-300 bg-emerald-50 text-emerald-700",
    PAUSED: "border-sky-300 bg-sky-50 text-sky-700",
    DEFAULTED: "border-red-300 bg-red-50 text-red-700",
    CANCELED: "border-gray-300 bg-gray-50 text-gray-700",
  };

  const daysUntil = debt.nextDueDate
    ? Math.round((new Date(debt.nextDueDate).getTime() - todayMs) / 86400000)
    : null;
  const urgent = daysUntil !== null && daysUntil <= 7;
  const canPay = debt.status === "ACTIVE" && accounts.length > 0;

  return (
    <div className={`rounded-xl border bg-card p-4 animate-fade-up transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${urgent ? "border-rose-500/25" : "border-border"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{debt.name}</p>
            <Badge className={statusColors[debt.status]}>{debtStatusLabels[debt.status]}</Badge>
          </div>
          {debt.lender && <p className="mt-0.5 text-xs text-muted-foreground">{debt.lender}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {debtTypeLabels[debt.type]} · {debt.currency}
            {debt.interestRate != null ? ` · ${debt.interestRate}% TNA` : ""}
          </p>
          {daysUntil !== null && (
            <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
              urgent
                ? "border-rose-500/25 bg-rose-500/12 text-rose-400"
                : "border-border bg-secondary text-muted-foreground"
            }`}>
              <CreditCard className="h-3 w-3" aria-hidden="true" />
              {daysUntil === 0 ? "Vence hoy" : daysUntil < 0 ? `Venció hace ${-daysUntil}d` : `Vence en ${daysUntil}d`}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-rose-400">{formatMoney(debt.outstandingAmount, debt.currency)}</p>
          <p className="text-xs text-muted-foreground">de {formatMoney(debt.originalAmount, debt.currency)}</p>
          {debt.minimumPayment && (
            <p className="text-xs text-muted-foreground">Mín: {formatMoney(debt.minimumPayment, debt.currency)}</p>
          )}
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-[width] duration-700 ease-out"
          style={{ width: `${displayWidth}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{debt.paidPercent.toFixed(0)}% pagado</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {canPay && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPaying}
            onClick={isQuickPayOpen ? onQuickPayCancel : onQuickPayOpen}
          >
            {isPaying ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            )}
            Registrar pago
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Editar
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={isDeleting} onClick={onDelete}>
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
          Eliminar
        </Button>
      </div>

      {isQuickPayOpen && (
        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Registrar pago</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cuenta</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={quickPayAccountId}
                onChange={(e) => onQuickPayAccountChange(e.target.value)}
              >
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {quickPayErrors.accountId ? <p className="text-xs text-destructive">{quickPayErrors.accountId}</p> : null}
              {quickPayErrors.debtId ? <p className="text-xs text-destructive">{quickPayErrors.debtId}</p> : null}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Monto ({debt.currency})</label>
              <Input
                inputMode="decimal"
                value={quickPayAmount}
                onChange={(e) => onQuickPayAmountChange(e.target.value)}
                placeholder="0"
                className="h-9"
              />
              {quickPayErrors.amount ? <p className="text-xs text-destructive">{quickPayErrors.amount}</p> : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isPaying}
              onClick={onQuickPayConfirm}
            >
              {isPaying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              Confirmar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onQuickPayCancel}>
              <X className="h-4 w-4" aria-hidden="true" />
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatMoney(value: number, currency: CurrencyCode) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
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
