"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDebts, useCreateDebt, useUpdateDebt, useDeleteDebt, usePayDebt } from "@/hooks/use-debts";
import { useCCSummaries, type CCSummary } from "@/hooks/use-cc-summary";
import {
  useCreditCards,
  usePayCardStatement,
  type CardStatementItem,
  type CreditCardItem,
} from "@/hooks/use-credit-cards";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
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
import Link from "next/link";
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
  accountId: string | null;
  originalAmount: number;
  outstandingAmount: number;
  minimumPayment: number | null;
  interestRate: number | null;
  nextDueDate: string | null;
  dueDay: number | null;
  notes: string | null;
  paidPercent: number;
};

type DebtsClientProps = { householdId: string; accounts: AccountOption[]; defaultCurrency?: "ARS" | "USD" };

type FormState = {
  name: string;
  accountId: string;
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
const creatableDebtTypes = debtTypes.filter((t) => t !== "PERSONAL");
const debtStatuses = Object.keys(debtStatusLabels) as DebtStatus[];

const formSchema = z.object({
  name: z.string().trim().min(2, "Ingresá un nombre.").max(100),
  accountId: z.string().optional(),
  lender: z.string().trim().max(100).optional(),
  type: z.enum(creatableDebtTypes as [DebtType, ...DebtType[]]),
  status: z.enum(debtStatuses as [DebtStatus, ...DebtStatus[]]),
  currency: z.enum(["ARS", "USD"]),
  originalAmount: moneySchema(),
  outstandingAmount: moneySchema({ allowZero: true }),
  minimumPayment: optionalMoneySchema(),
  interestRate: z.coerce.number().nonnegative().max(999).optional(),
  nextDueDate: z.string().optional(),
  dueDay: z.coerce.number().int().min(1).max(31).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const defaultForm: FormState = {
  name: "",
  accountId: "",
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

export function DebtsClient({ householdId, accounts, defaultCurrency = "ARS" }: DebtsClientProps) {
  const defaultAccount = getPreferredArsBankAccount(accounts);
  const [todayMs] = useState(() => Date.now());
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { data: debtsData, isLoading } = useDebts(householdId, statusFilter || undefined);
  const { data: ccSummaries = [], isLoading: isCCLoading } = useCCSummaries(householdId);
  const { data: creditCards = [], isLoading: isCreditCardsLoading } = useCreditCards(householdId);
  const createDebt = useCreateDebt();
  const updateDebt = useUpdateDebt();
  const deleteDebt = useDeleteDebt();
  const payDebt = usePayDebt();
  const payCardStatement = usePayCardStatement();

  const [activeCCAccount, setActiveCCAccount] = useState<CCSummary | null>(null);

  const isSaving = createDebt.isPending || updateDebt.isPending;
  const deletingDebtId = deleteDebt.isPending ? (deleteDebt.variables?.debtId ?? null) : null;
  const payingDebtId = payDebt.isPending ? (payDebt.variables?.debtId ?? null) : null;

  const [pendingDeleteDebt, setPendingDeleteDebt] = useState<DebtItem | null>(null);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ ...defaultForm, currency: defaultCurrency });
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [quickPayDebtId, setQuickPayDebtId] = useState<string | null>(null);
  const [quickPayAccountId, setQuickPayAccountId] = useState<string>("");
  const [quickPayAmount, setQuickPayAmount] = useState<string>("");
  const [quickPayErrors, setQuickPayErrors] = useState<{ accountId?: string; amount?: string; debtId?: string }>({});
  const [payingStatementId, setPayingStatementId] = useState<string | null>(null);
  const [cardPayAccountId, setCardPayAccountId] = useState("");
  const [cardPayAmount, setCardPayAmount] = useState("");
  const [cardPayErrors, setCardPayErrors] = useState<{ sourceAccountId?: string; amount?: string }>({});

  const debts = useMemo(() => debtsData?.debts ?? [], [debtsData]);
  const totalOutstanding = debtsData?.totalOutstanding ?? 0;

  // CC accounts that are NOT linked to any Debt record — shown as virtual items in the list
  const unlinkedCCSummaries = useMemo(
    () => creditCards.length > 0
      ? []
      : ccSummaries.filter((s) => !debts.some((d) => d.accountId === s.id) && Math.abs(s.currentBalance) > 0),
    [ccSummaries, creditCards.length, debts],
  );
  const ccUnlinkedTotal = useMemo(
    () => unlinkedCCSummaries.reduce((sum, s) => sum + Math.abs(s.currentBalance), 0),
    [unlinkedCCSummaries],
  );
  const cardStatementTotal = useMemo(
    () => creditCards.reduce((sum, card) => sum + (card.activeStatement?.pendingAmount ?? 0), 0),
    [creditCards],
  );
  const totalItemCount = debts.length + unlinkedCCSummaries.length;
  const augmentedTotal = totalOutstanding + ccUnlinkedTotal + cardStatementTotal;

  const summary = useMemo(() => buildDebtSummary(debts, augmentedTotal, todayMs), [debts, augmentedTotal, todayMs]);

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

    const input = {
      householdId,
      ...parsed.data,
      accountId: form.accountId || (editingDebtId ? null : undefined),
      nextDueDate: parsed.data.nextDueDate || (editingDebtId ? null : undefined),
      lender: parsed.data.lender || (editingDebtId ? null : undefined),
      minimumPayment: parsed.data.minimumPayment ?? (editingDebtId ? null : undefined),
      interestRate: parsed.data.interestRate ?? (editingDebtId ? null : undefined),
    };

    try {
      if (editingDebtId) {
        await updateDebt.mutateAsync({ debtId: editingDebtId, ...input });
      } else {
        await createDebt.mutateAsync(input);
      }
      resetForm();
      setIsFormOpen(false);
    } catch (err: unknown) {
      const e = err as Error & { fieldErrors?: FormErrors };
      if (e.fieldErrors) setErrors(e.fieldErrors);
      setMessage(e.message ?? "No se pudo guardar el compromiso.");
    }
  }

  function requestDelete(debt: DebtItem) {
    setPendingDeleteDebt(debt);
  }

  async function confirmDelete() {
    if (!pendingDeleteDebt) return;
    const debtId = pendingDeleteDebt.id;
    setMessage(null);
    try {
      await deleteDebt.mutateAsync({ debtId, householdId });
      setPendingDeleteDebt(null);
      if (editingDebtId === debtId) resetForm();
    } catch {
      // toast shown by hook
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
    try {
      await payDebt.mutateAsync({
        householdId,
        debtId: debt.id,
        accountId: quickPayAccountId,
        amount: parsedAmount.data,
        currency: debt.currency,
        debtName: debt.name,
        occurredAt: formatArgentinaDateInput(),
      });
      toast.success(`Pago de ${debt.name} registrado correctamente.`);
      cancelQuickPay();
    } catch (err: unknown) {
      const e = err as Error & { fieldErrors?: { accountId?: string; amount?: string; debtId?: string } };
      if (e.fieldErrors) setQuickPayErrors(e.fieldErrors);
      else toast.error(e.message);
    }
  }

  function openCardPayment(statement: CardStatementItem) {
    const defaultPayAccount = getPreferredPaymentAccount(accounts, statement.currency);
    setPayingStatementId(statement.id);
    setCardPayAccountId(defaultPayAccount?.id ?? "");
    setCardPayAmount(String(statement.minimumPayment ?? statement.pendingAmount));
    setCardPayErrors({});
  }

  function cancelCardPayment() {
    setPayingStatementId(null);
    setCardPayAccountId("");
    setCardPayAmount("");
    setCardPayErrors({});
  }

  async function handleCardPaymentConfirm(statement: CardStatementItem) {
    if (!cardPayAccountId) {
      setCardPayErrors({ sourceAccountId: "Seleccioná una cuenta origen." });
      return;
    }

    const parsedAmount = parseMoneyInput(cardPayAmount);
    if (!parsedAmount.success || parsedAmount.data == null) {
      setCardPayErrors({ amount: parsedAmount.success ? "Ingresá un monto." : parsedAmount.error });
      return;
    }

    if (parsedAmount.data > statement.pendingAmount) {
      setCardPayErrors({ amount: `El pago no puede superar el saldo pendiente (${formatMoney(statement.pendingAmount, statement.currency)}).` });
      return;
    }

    setCardPayErrors({});
    try {
      await payCardStatement.mutateAsync({
        householdId,
        statementId: statement.id,
        sourceAccountId: cardPayAccountId,
        amount: parsedAmount.data,
        kind: parsedAmount.data >= statement.pendingAmount
          ? "FULL"
          : statement.minimumPayment != null && Math.abs(parsedAmount.data - statement.minimumPayment) < 0.01
            ? "MINIMUM"
            : "PARTIAL",
        paidAt: formatArgentinaDateInput(),
      });
      cancelCardPayment();
    } catch (err: unknown) {
      const e = err as Error & { fieldErrors?: { sourceAccountId?: string; amount?: string } };
      if (e.fieldErrors) setCardPayErrors(e.fieldErrors);
      else toast.error(e.message);
    }
  }

  function startEditing(debt: DebtItem) {
    setEditingDebtId(debt.id);
    setIsFormOpen(true);
    setErrors({});
    setMessage(null);
    setForm({
      name: debt.name,
      accountId: debt.accountId ?? "",
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
    setForm({ ...defaultForm, currency: defaultCurrency });
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
      <div className="grid gap-3 sm:gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <AppFormPanel
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          className="border-border bg-card/80 shadow-[0_24px_80px_rgba(0,0,0,0.32)] xl:rounded-[var(--v2-radius-xl)]"
        >
          <div className={appFormHeaderClass("border-border bg-card/95 xl:bg-transparent")}>
            <div className="flex items-start gap-3 p-5 sm:p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/50 text-foreground">
                <CreditCard className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-tight text-foreground">
                  {editingDebtId ? "Ajustar compromiso" : "Nuevo compromiso"}
                </h2>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
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
                  <select
                    className={selectClass}
                    value={form.type}
                    onChange={(e) => {
                      const newType = e.target.value as DebtType;
                      updateForm("type", newType);
                      if (newType !== "CREDIT_CARD") updateForm("accountId", "");
                    }}
                  >
                    {form.type === "PERSONAL" && (
                      <option value="PERSONAL" disabled>{debtTypeLabels["PERSONAL"]} (legacy)</option>
                    )}
                    {creatableDebtTypes.map((type) => <option key={type} value={type}>{debtTypeLabels[type]}</option>)}
                  </select>
                </Field>
                <Field label="Estado" error={errors.status}>
                  <select className={selectClass} value={form.status} onChange={(e) => updateForm("status", e.target.value as DebtStatus)}>
                    {debtStatuses.map((status) => <option key={status} value={status}>{debtStatusLabels[status]}</option>)}
                  </select>
                </Field>
              </div>

              {form.type === "CREDIT_CARD" && (
                <Field label="Cuenta de tarjeta vinculada" error={errors.accountId}>
                  <select
                    className={selectClass}
                    value={form.accountId}
                    onChange={(e) => updateForm("accountId", e.target.value)}
                  >
                    <option value="">Sin vincular</option>
                    {accounts
                      .filter((a) => a.type === "CREDIT_CARD")
                      .map((a) => (
                        <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                      ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Si vinculás una cuenta, los gastos en esa TDC suman automáticamente al saldo pendiente.
                  </p>
                </Field>
              )}

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
                <textarea className="v2-focus-ring min-h-24 w-full resize-none rounded-2xl border border-border bg-muted/40 px-4 py-3 text-base md:text-sm text-foreground outline-none placeholder:text-muted-foreground" maxLength={1000} value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} placeholder="Detalle opcional" />
              </Field>

              {message ? (
                <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-destructive">
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
          <DebtBriefing summary={summary} debtCount={totalItemCount + creditCards.length} isLoading={isLoading || isCCLoading || isCreditCardsLoading} onCreate={openNewDebt} />

          <CreditCardsStatementPanel
            cards={creditCards}
            accounts={accounts}
            isLoading={isCreditCardsLoading}
            payingStatementId={payingStatementId}
            payAccountId={cardPayAccountId}
            payAmount={cardPayAmount}
            payErrors={cardPayErrors}
            isPaying={payCardStatement.isPending}
            onOpenPayment={openCardPayment}
            onCancelPayment={cancelCardPayment}
            onPayAccountChange={setCardPayAccountId}
            onPayAmountChange={setCardPayAmount}
            onConfirmPayment={handleCardPaymentConfirm}
          />

          <PremiumCard variant="default" className="overflow-hidden">
            <PremiumCardHeader className="pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <PremiumCardTitle>Compromisos pendientes</PremiumCardTitle>
                  <PremiumCardDescription>Pasivos formales y tarjetas con saldo pendiente.</PremiumCardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="v2-focus-ring h-9 rounded-2xl border border-border bg-muted/40 px-3 text-base md:text-sm text-foreground outline-none"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">Con saldo hoy</option>
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
              {isLoading || isCCLoading || isCreditCardsLoading ? (
                <DebtSkeletonList />
              ) : totalItemCount === 0 && creditCards.length === 0 ? (
                <DebtEmptyState onCreate={openNewDebt} />
              ) : totalItemCount === 0 ? (
                <div className="rounded-[1.75rem] border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Las tarjetas ya se gestionan por resumen arriba. Acá van a aparecer préstamos y cuotas no vinculadas.
                </div>
              ) : (
                <div className="grid gap-3">
                  <AnimatePresence initial={false}>
                    {unlinkedCCSummaries.map((account) => (
                      <CCVirtualCard
                        key={account.id}
                        account={account}
                        onViewMovements={() => setActiveCCAccount(account)}
                      />
                    ))}
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

        <MobileCreateFab label="Nuevo crédito o cuota" onClick={openNewDebt} />
      </div>

      <CCTransactionsSheet
        householdId={householdId}
        account={activeCCAccount}
        accounts={accounts}
        linkedDebt={activeCCAccount ? (debts.find((d) => d.accountId === activeCCAccount.id) ?? null) : null}
        onClose={() => setActiveCCAccount(null)}
      />

      <DeleteDebtDialog
        debt={pendingDeleteDebt}
        isDeleting={deletingDebtId === pendingDeleteDebt?.id}
        onCancel={() => setPendingDeleteDebt(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

const inputClass = "v2-focus-ring h-11 rounded-2xl border-border bg-muted/40 text-foreground placeholder:text-muted-foreground";
const selectClass = "v2-focus-ring h-11 w-full rounded-2xl border border-border bg-muted/40 px-4 text-base md:text-sm text-foreground outline-none transition hover:bg-muted/60";

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
              <Skeleton className="h-5 w-40 rounded-full bg-muted" />
              <Skeleton className="h-8 w-80 max-w-full rounded-full bg-muted" />
              <Skeleton className="h-3 w-full rounded-full bg-muted" />
              <div className="grid gap-3 sm:grid-cols-3">
                {[1, 2, 3].map((item) => <Skeleton key={item} className="h-20 rounded-3xl bg-muted" />)}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-200" aria-hidden="true" />
                    Radar de compromisos
                  </div>
                  <h2 className="text-balance text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
                    {state.title}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{state.description}</p>
                </div>
                <div className="rounded-[2rem] border border-rose-300/20 bg-rose-400/10 p-4 text-right shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <p className="text-[11px] font-semibold uppercase text-destructive/70">Saldo pendiente</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
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
    <div className="min-w-0 rounded-3xl border border-border bg-muted/30 p-4">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      <p className="mt-3 text-[11px] font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function CreditCardsStatementPanel({
  cards,
  accounts,
  isLoading,
  payingStatementId,
  payAccountId,
  payAmount,
  payErrors,
  isPaying,
  onOpenPayment,
  onCancelPayment,
  onPayAccountChange,
  onPayAmountChange,
  onConfirmPayment,
}: {
  cards: CreditCardItem[];
  accounts: AccountOption[];
  isLoading: boolean;
  payingStatementId: string | null;
  payAccountId: string;
  payAmount: string;
  payErrors: { sourceAccountId?: string; amount?: string };
  isPaying: boolean;
  onOpenPayment: (statement: CardStatementItem) => void;
  onCancelPayment: () => void;
  onPayAccountChange: (value: string) => void;
  onPayAmountChange: (value: string) => void;
  onConfirmPayment: (statement: CardStatementItem) => void;
}) {
  if (!isLoading && cards.length === 0) return null;

  return (
    <PremiumCard variant="raised" className="overflow-hidden">
      <PremiumCardHeader className="pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <PremiumCardTitle>Tarjetas de crédito</PremiumCardTitle>
            <PremiumCardDescription>Resúmenes, ciclos y pagos separados del historial.</PremiumCardDescription>
          </div>
          <Badge className="w-fit border-sky-300/20 bg-sky-300/10 text-sky-400">
            Statements
          </Badge>
        </div>
      </PremiumCardHeader>
      <PremiumCardContent>
        {isLoading ? (
          <div className="grid gap-3">
            {[0, 1].map((item) => (
              <Skeleton key={item} className="h-56 rounded-[1.75rem] bg-muted" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3">
            {cards.map((card) => (
              <CreditCardStatementCard
                key={card.id}
                card={card}
                accounts={accounts}
                isPaymentOpen={payingStatementId === card.activeStatement?.id}
                payAccountId={payAccountId}
                payAmount={payAmount}
                payErrors={payErrors}
                isPaying={isPaying}
                onOpenPayment={onOpenPayment}
                onCancelPayment={onCancelPayment}
                onPayAccountChange={onPayAccountChange}
                onPayAmountChange={onPayAmountChange}
                onConfirmPayment={onConfirmPayment}
              />
            ))}
          </div>
        )}
      </PremiumCardContent>
    </PremiumCard>
  );
}

function CreditCardStatementCard({
  card,
  accounts,
  isPaymentOpen,
  payAccountId,
  payAmount,
  payErrors,
  isPaying,
  onOpenPayment,
  onCancelPayment,
  onPayAccountChange,
  onPayAmountChange,
  onConfirmPayment,
}: {
  card: CreditCardItem;
  accounts: AccountOption[];
  isPaymentOpen: boolean;
  payAccountId: string;
  payAmount: string;
  payErrors: { sourceAccountId?: string; amount?: string };
  isPaying: boolean;
  onOpenPayment: (statement: CardStatementItem) => void;
  onCancelPayment: () => void;
  onPayAccountChange: (value: string) => void;
  onPayAmountChange: (value: string) => void;
  onConfirmPayment: (statement: CardStatementItem) => void;
}) {
  const statement = card.activeStatement;
  const pending = statement?.pendingAmount ?? 0;
  const currency = card.currency;
  const pressure = getCardPressureCopy(card.pressure);
  const paymentAccounts = accounts.filter((account) => account.currency === currency && account.type !== "CREDIT_CARD");
  const canPay = !!statement && pending > 0 && !!card.accountId && paymentAccounts.length > 0;

  return (
    <article className="rounded-[1.75rem] border border-border bg-muted/25 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-foreground">{card.name}</p>
            <Badge className={getStatementBadgeClass(statement?.status ?? "OPEN")}>
              {statement ? getStatementStatusLabel(statement.status) : "Sin resumen"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {card.issuer ?? "Tarjeta"} · {card.currency}
            {card.last4 ? ` · **** ${card.last4}` : ""}
          </p>
          {statement?.dueDate ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Vence {formatDate(statement.dueDate)} · {pressure}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{pressure}</p>
          )}
        </div>
        <div className="shrink-0 text-left lg:text-right">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Saldo pendiente</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {formatMoney(pending, currency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Mínimo: {statement?.minimumPayment != null ? formatMoney(statement.minimumPayment, currency) : "No informado"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <CardStatementMetric label="Pendiente" value={statement ? formatMoney(pending, currency) : "Sin resumen"} />
        <CardStatementMetric
          label="Ciclo actual"
          value={card.currentStatement ? formatMoney(card.currentStatement.totalAmount, currency) : "Sin consumos"}
        />
        <CardStatementMetric label="Historial" value={`${card.history.length} resúmenes`} />
      </div>

      {card.utilizationPercent != null ? (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Uso de límite</span>
            <span>{card.utilizationPercent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-300 via-cyan-300 to-emerald-200"
              style={{ width: `${Math.min(card.utilizationPercent, 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canPay && statement ? (
          <ActionButton
            type="button"
            size="sm"
            onClick={isPaymentOpen ? onCancelPayment : () => onOpenPayment(statement)}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Pagar tarjeta
          </ActionButton>
        ) : null}
        <Badge className="border-border bg-muted/30 text-muted-foreground">
          {statement?.transactionCount ?? 0} movimientos del resumen
        </Badge>
        <Badge className="border-border bg-muted/30 text-muted-foreground">
          {statement?.paymentCount ?? 0} pagos
        </Badge>
      </div>

      <AnimatePresence initial={false}>
        {isPaymentOpen && statement ? (
          <motion.div
            {...cardMotion}
            className="mt-4 space-y-3 rounded-[1.5rem] border border-emerald-300/20 bg-emerald-300/10 p-4"
          >
            <p className="text-xs font-semibold uppercase text-emerald-400">Pago de resumen</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Desde</label>
                <select
                  className="v2-focus-ring h-10 w-full rounded-2xl border border-border bg-card/70 px-3 text-base md:text-sm text-foreground outline-none"
                  value={payAccountId}
                  onChange={(e) => onPayAccountChange(e.target.value)}
                >
                  {paymentAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
                {payErrors.sourceAccountId ? <p className="text-xs text-rose-200">{payErrors.sourceAccountId}</p> : null}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Monto ({currency})</label>
                <Input
                  inputMode="decimal"
                  onKeyDown={onMoneyKeyDown}
                  value={payAmount}
                  onChange={(e) => onPayAmountChange(e.target.value)}
                  className="v2-focus-ring h-10 rounded-2xl border-border bg-card/70 text-foreground placeholder:text-muted-foreground"
                />
                {payErrors.amount ? <p className="text-xs text-rose-200">{payErrors.amount}</p> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {statement.minimumPayment != null ? (
                <ActionButton type="button" variant="glass" size="sm" onClick={() => onPayAmountChange(String(statement.minimumPayment))}>
                  Mínimo
                </ActionButton>
              ) : null}
              <ActionButton type="button" variant="glass" size="sm" onClick={() => onPayAmountChange(String(statement.pendingAmount))}>
                Total
              </ActionButton>
              <ActionButton type="button" size="sm" disabled={isPaying} onClick={() => onConfirmPayment(statement)}>
                {isPaying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Confirmar
              </ActionButton>
              <ActionButton type="button" variant="quiet" size="sm" onClick={onCancelPayment}>
                Cancelar
              </ActionButton>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
}

function CardStatementMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-muted/30 p-3">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-foreground">{value}</p>
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
      className={`rounded-[1.75rem] border bg-muted/25 p-4 transition duration-200 hover:-translate-y-0.5 hover:bg-muted/40 sm:p-5 ${
        urgent ? "border-rose-300/25 shadow-[0_18px_55px_rgba(244,63,94,0.08)]" : "border-border"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-foreground">{debt.name}</p>
            <Badge className={getDebtStatusClass(debt.status)}>{debtStatusLabels[debt.status]}</Badge>
            {debt.type === "PERSONAL" && (
              <Badge className="border-amber-300/20 bg-amber-300/10 text-amber-600">Legacy</Badge>
            )}
          </div>
          {debt.lender ? <p className="mt-1 text-sm text-muted-foreground">{debt.lender}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {debtTypeLabels[debt.type]} · {debt.currency}
            {debt.interestRate != null ? ` · ${debt.interestRate}% TNA` : ""}
          </p>
          {daysUntil !== null ? (
            <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
              urgent
                ? "border-rose-300/25 bg-rose-400/10 text-destructive"
                : "border-border bg-muted/30 text-muted-foreground"
            }`}>
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {daysUntil === 0 ? "Vence hoy" : daysUntil < 0 ? `Venció hace ${-daysUntil}d` : `Vence en ${daysUntil}d`}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-xl font-semibold tabular-nums text-destructive">{formatMoney(debt.outstandingAmount, debt.currency)}</p>
          <p className="text-xs text-muted-foreground">de {formatMoney(debt.originalAmount, debt.currency)}</p>
          {debt.minimumPayment ? <p className="text-xs text-muted-foreground">Mín: {formatMoney(debt.minimumPayment, debt.currency)}</p> : null}
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-teal-300 to-lime-200 transition-[width] duration-700 ease-out"
          style={{ width: `${displayWidth}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{debt.paidPercent.toFixed(0)}% pagado</p>

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
            <p className="text-xs font-semibold uppercase text-emerald-400">Registrar pago</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cuenta</label>
                <select
                  className="v2-focus-ring h-10 w-full rounded-2xl border border-border bg-card/70 px-3 text-base md:text-sm text-foreground outline-none"
                  value={quickPayAccountId}
                  onChange={(e) => onQuickPayAccountChange(e.target.value)}
                >
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
                {quickPayErrors.accountId ? <p className="text-xs text-rose-200">{quickPayErrors.accountId}</p> : null}
                {quickPayErrors.debtId ? <p className="text-xs text-rose-200">{quickPayErrors.debtId}</p> : null}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Monto ({debt.currency})</label>
                <Input
                  inputMode="decimal"
                  onKeyDown={onMoneyKeyDown}
                  value={quickPayAmount}
                  onChange={(e) => onQuickPayAmountChange(e.target.value)}
                  placeholder="0"
                  className="v2-focus-ring h-10 rounded-2xl border-border bg-card/70 text-foreground placeholder:text-muted-foreground"
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
        <div key={item} className="space-y-4 rounded-[1.75rem] border border-border bg-muted/25 p-4">
          <div className="flex justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40 bg-muted" />
              <Skeleton className="h-3 w-56 max-w-full bg-muted" />
              <Skeleton className="h-6 w-28 rounded-full bg-muted" />
            </div>
            <Skeleton className="h-12 w-24 rounded-2xl bg-muted" />
          </div>
          <Skeleton className="h-2 w-full rounded-full bg-muted" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-xl bg-muted" />
            <Skeleton className="h-9 w-20 rounded-xl bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DebtEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-border bg-muted/20 p-4 sm:p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
        <CreditCard className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">Sin compromisos registrados</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Registrá préstamos, tarjetas o cuotas para ver qué pesa sobre tu mes.
      </p>
      <ActionButton type="button" className="mt-5" onClick={onCreate}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Crear compromiso
      </ActionButton>
    </div>
  );
}

function CCVirtualCard({
  account,
  onViewMovements,
}: {
  account: CCSummary;
  onViewMovements: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const owed = Math.abs(account.currentBalance);
  const currency = account.currency as "ARS" | "USD";

  return (
    <motion.article
      layout
      {...(shouldReduceMotion ? { initial: false } : cardMotion)}
      className="rounded-[1.75rem] border border-border bg-muted/25 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold text-foreground">{account.name}</p>
            <Badge className="border-sky-300/20 bg-sky-300/10 text-sky-400">Tarjeta importada</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Tarjeta de crédito · {account.currency}
          </p>
          {account.importedCount > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {account.importedCount} mov. importados
              {account.lastImportDate ? ` · Últ. ${formatDate(account.lastImportDate)}` : ""}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-xl font-semibold tabular-nums text-destructive">{formatMoney(owed, currency)}</p>
          <p className="text-xs text-muted-foreground">saldo a pagar</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton type="button" variant="glass" size="sm" onClick={onViewMovements}>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          Ver movimientos
        </ActionButton>
      </div>
    </motion.article>
  );
}

type CCTransaction = {
  id: string;
  description: string | null;
  amount: number;
  type: string;
  occurredAt: string;
  category: { name: string; emoji: string | null } | null;
};

function CCAccountsSection({
  summaries,
  isLoading,
  onOpen,
}: {
  summaries: CCSummary[];
  isLoading: boolean;
  onOpen: (account: CCSummary) => void;
}) {
  if (!isLoading && summaries.length === 0) return null;

  return (
    <PremiumCard variant="default" className="overflow-hidden">
      <PremiumCardHeader className="pb-4">
        <PremiumCardTitle>Tarjetas de crédito</PremiumCardTitle>
        <PremiumCardDescription>Saldo importado desde resúmenes.</PremiumCardDescription>
      </PremiumCardHeader>
      <PremiumCardContent>
        {isLoading ? (
          <div className="grid gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-3xl border border-border bg-muted/25 p-4">
                <Skeleton className="h-10 w-10 rounded-2xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32 bg-muted" />
                  <Skeleton className="h-3 w-48 bg-muted" />
                </div>
                <Skeleton className="h-6 w-20 bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3">
            {summaries.map((account) => {
              const owed = Math.abs(account.currentBalance);
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => onOpen(account)}
                  className="v2-focus-ring flex w-full items-center gap-3 rounded-3xl border border-border bg-muted/25 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-muted/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
                    <CreditCard className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{account.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {account.importedCount > 0
                        ? `${account.importedCount} mov. importados`
                        : "Sin movimientos importados"}
                      {account.lastImportDate
                        ? ` · Últ. ${formatDate(account.lastImportDate)}`
                        : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-destructive">
                      {formatMoney(owed, account.currency as "ARS" | "USD")}
                    </p>
                    <div className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                      Ver movimientos
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </PremiumCardContent>
    </PremiumCard>
  );
}

function CCTransactionsSheet({
  householdId,
  account,
  accounts,
  linkedDebt,
  onClose,
}: {
  householdId: string;
  account: CCSummary | null;
  accounts: AccountOption[];
  linkedDebt: DebtItem | null;
  onClose: () => void;
}) {
  const [transactions, setTransactions] = useState<CCTransaction[]>([]);
  const [fetching, setFetching] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payAccountId, setPayAccountId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payErrors, setPayErrors] = useState<{ accountId?: string; amount?: string }>({});
  const payDebt = usePayDebt();

  const defaultAccount = getPreferredArsBankAccount(accounts);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      if (!account) {
        setTransactions([]);
        setIsPayOpen(false);
        return;
      }

      setFetching(true);
      const params = new URLSearchParams({ householdId, accountId: account.id, limit: "50" });
      fetch(`/api/transactions?${params}`)
        .then((r) => r.json() as Promise<{ data?: { data?: CCTransaction[] } }>)
        .then((payload) => {
          if (!cancelled) setTransactions(payload.data?.data ?? []);
        })
        .catch(() => {
          if (!cancelled) setTransactions([]);
        })
        .finally(() => {
          if (!cancelled) setFetching(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [account, householdId]);

  function openPay() {
    setPayAccountId(defaultAccount?.id ?? "");
    setPayAmount(linkedDebt ? String(linkedDebt.outstandingAmount) : "");
    setPayErrors({});
    setIsPayOpen(true);
  }

  function cancelPay() {
    setIsPayOpen(false);
    setPayErrors({});
  }

  async function handlePayConfirm() {
    if (!linkedDebt || !account) return;
    if (!payAccountId) { setPayErrors({ accountId: "Seleccioná una cuenta." }); return; }
    const parsedAmount = parseMoneyInput(payAmount);
    if (!parsedAmount.success || parsedAmount.data == null) {
      setPayErrors({ amount: parsedAmount.success ? "Ingresá un monto." : parsedAmount.error });
      return;
    }
    if (parsedAmount.data > linkedDebt.outstandingAmount) {
      setPayErrors({ amount: `El pago no puede superar el saldo pendiente (${formatMoney(linkedDebt.outstandingAmount, linkedDebt.currency)}).` });
      return;
    }
    setPayErrors({});
    try {
      await payDebt.mutateAsync({
        householdId,
        debtId: linkedDebt.id,
        accountId: payAccountId,
        amount: parsedAmount.data,
        currency: linkedDebt.currency,
        debtName: linkedDebt.name,
        occurredAt: formatArgentinaDateInput(),
      });
      toast.success(`Pago de ${linkedDebt.name} registrado.`);
      cancelPay();
      onClose();
    } catch (err: unknown) {
      const e = err as Error & { fieldErrors?: { accountId?: string; amount?: string } };
      if (e.fieldErrors) setPayErrors(e.fieldErrors);
      else toast.error((err as Error).message);
    }
  }

  const currency = account?.currency as "ARS" | "USD" | undefined ?? "ARS";
  const owed = account ? Math.abs(account.currentBalance) : 0;

  return (
    <AppFormPanel
      isOpen={account !== null}
      onClose={onClose}
      className="border-border bg-card/80 shadow-[0_24px_80px_rgba(0,0,0,0.32)] xl:rounded-[var(--v2-radius-xl)]"
    >
      <div className={appFormHeaderClass("border-border bg-card/95 xl:bg-transparent")}>
        <div className="flex items-start gap-3 p-5 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/50 text-foreground">
            <CreditCard className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold leading-tight text-foreground">
              {account?.name ?? "Tarjeta"}
            </h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {owed > 0 ? `Saldo a pagar: ${formatMoney(owed, currency)}` : "Sin saldo pendiente"}
            </p>
          </div>
          <ActionButton
            type="button"
            variant="quiet"
            size="icon"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </ActionButton>
        </div>

        {linkedDebt && !isPayOpen && (
          <div className="px-5 pb-4 sm:px-6">
            <ActionButton type="button" variant="glass" size="sm" onClick={openPay}>
              <CheckCircle2 className="h-4 w-4 text-emerald-200" aria-hidden="true" />
              Registrar pago
            </ActionButton>
          </div>
        )}

        {isPayOpen && linkedDebt && (
          <div className="mx-5 mb-4 space-y-3 rounded-[1.5rem] border border-emerald-300/20 bg-emerald-300/10 p-4 sm:mx-6">
            <p className="text-xs font-semibold uppercase text-emerald-400">Registrar pago — {linkedDebt.name}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cuenta</label>
                <select
                  className="v2-focus-ring h-10 w-full rounded-2xl border border-border bg-card/70 px-3 text-base md:text-sm text-foreground outline-none"
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                >
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {payErrors.accountId ? <p className="text-xs text-rose-200">{payErrors.accountId}</p> : null}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Monto ({linkedDebt.currency})</label>
                <Input
                  inputMode="decimal"
                  onKeyDown={onMoneyKeyDown}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0"
                  className="v2-focus-ring h-10 rounded-2xl border-border bg-card/70 text-foreground placeholder:text-muted-foreground"
                />
                {payErrors.amount ? <p className="text-xs text-rose-200">{payErrors.amount}</p> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton type="button" size="sm" disabled={payDebt.isPending} onClick={handlePayConfirm}>
                {payDebt.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                Confirmar
              </ActionButton>
              <ActionButton type="button" variant="quiet" size="sm" onClick={cancelPay}>
                <X className="h-4 w-4" aria-hidden="true" />
                Cancelar
              </ActionButton>
            </div>
          </div>
        )}
      </div>
      <div className={appFormContentClass(account !== null, "px-5 sm:px-6 pb-6")}>
        {fetching ? (
          <div className="grid gap-3 pt-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-3xl border border-border bg-muted/25 p-3">
                <Skeleton className="h-8 w-8 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40 bg-muted" />
                  <Skeleton className="h-3 w-28 bg-muted" />
                </div>
                <Skeleton className="h-5 w-20 bg-muted" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="mt-4 rounded-[1.75rem] border border-dashed border-border bg-muted/20 p-6 text-center">
            <p className="text-sm text-muted-foreground">No hay movimientos importados para esta tarjeta.</p>
          </div>
        ) : (
          <div className="grid gap-2 pt-1">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 rounded-3xl border border-border bg-muted/25 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 text-sm">
                  {tx.category?.emoji ?? "💳"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {tx.description ?? "Sin descripción"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx.category?.name ?? "Sin categoría"} · {formatDate(tx.occurredAt)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-destructive">
                  {formatMoney(tx.amount, currency)}
                </p>
              </div>
            ))}
            <div className="mt-2 flex justify-center">
              <Link
                href={`/transactions?accountId=${account?.id ?? ""}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted/50"
                onClick={onClose}
              >
                Ver todos en Movimientos
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppFormPanel>
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
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
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-400/10 text-destructive">
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
                <div className="rounded-3xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Saldo pendiente
                  </div>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
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
      description: "Cuando registres un crédito o cuota, el sistema va a ordenar saldo, vencimiento y próximo pago en un solo lugar.",
    };
  }

  if (summary.defaulted > 0) {
    return {
      title: "Hay compromisos que necesitan atención hoy.",
      description: "Tenés un compromiso formal en mora. Conviene priorizar contacto, pago mínimo o reordenamiento antes de sumar nuevos gastos.",
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
  if (status === "ACTIVE") return "border-amber-300/20 bg-amber-300/10 text-amber-500";
  if (status === "PAID") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-400";
  if (status === "PAUSED") return "border-sky-300/20 bg-sky-300/10 text-sky-400";
  if (status === "DEFAULTED") return "border-rose-300/20 bg-rose-400/10 text-destructive";
  return "border-border bg-muted/20 text-muted-foreground";
}

function getStatementStatusLabel(status: CardStatementItem["status"]) {
  if (status === "OPEN") return "Ciclo actual";
  if (status === "CLOSED_PENDING_PAYMENT") return "Resumen cerrado";
  if (status === "PARTIALLY_PAID") return "Pago parcial";
  if (status === "PAID") return "Pagado";
  if (status === "OVERDUE") return "Vencido";
  return "Archivado";
}

function getStatementBadgeClass(status: CardStatementItem["status"]) {
  if (status === "OVERDUE") return "border-rose-300/20 bg-rose-400/10 text-destructive";
  if (status === "CLOSED_PENDING_PAYMENT") return "border-amber-300/20 bg-amber-300/10 text-amber-500";
  if (status === "PARTIALLY_PAID") return "border-sky-300/20 bg-sky-300/10 text-sky-400";
  if (status === "PAID") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-400";
  if (status === "ARCHIVED") return "border-border bg-muted/20 text-muted-foreground";
  return "border-cyan-300/20 bg-cyan-300/10 text-cyan-400";
}

function getCardPressureCopy(pressure: CreditCardItem["pressure"]) {
  if (pressure === "overdue") return "Presión financiera alta: vencida";
  if (pressure === "high") return "Presión financiera alta";
  if (pressure === "medium") return "Presión financiera media";
  if (pressure === "low") return "Presión financiera baja";
  return "Sin presión financiera";
}

function getPreferredPaymentAccount(accounts: AccountOption[], currency: CurrencyCode) {
  return (
    accounts.find((account) => account.currency === currency && account.type === "BANK") ??
    accounts.find((account) => account.currency === currency && account.type !== "CREDIT_CARD") ??
    accounts.find((account) => account.type !== "CREDIT_CARD")
  );
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
      <Label className="text-xs font-semibold uppercase text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
