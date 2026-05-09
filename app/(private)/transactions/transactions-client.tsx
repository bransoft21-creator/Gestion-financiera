"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  Loader2,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  AppFormPanel,
  MobileCreateFab,
  appFormActionsClass,
  appFormContentClass,
  appFormHeaderClass,
} from "@/components/app/mobile-form";
import { formatArgentinaDateInput } from "@/lib/dates";
import { moneySchema } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TransactionType =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER"
  | "ADJUSTMENT"
  | "DEBT_PAYMENT"
  | "GOAL_CONTRIBUTION"
  | "INVESTMENT";

type CategoryType = "INCOME" | "EXPENSE" | "TRANSFER" | "DEBT" | "GOAL" | "INVESTMENT" | "ADJUSTMENT";
type CurrencyCode = "ARS" | "USD";

type AccountOption = {
  id: string;
  name: string;
  type: string;
  currency: CurrencyCode;
};

type CategoryOption = {
  id: string;
  name: string;
  type: CategoryType;
};

type TransactionStatus = "PENDING" | "CONFIRMED" | "CANCELED";
type ExpenseType = "FIXED" | "VARIABLE" | "EXTRAORDINARY";
type TransactionOrigin = "MANUAL" | "CARD_SUMMARY" | "BANK" | "MERCADO_PAGO";
type PaymentMethod = "CASH" | "DEBIT" | "CREDIT" | "TRANSFER";

type TransactionItem = {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  currency: CurrencyCode;
  amount: string;
  description: string | null;
  notes: string | null;
  expenseType: ExpenseType | null;
  origin: TransactionOrigin;
  paymentMethod: PaymentMethod | null;
  isInstallment: boolean;
  installmentNumber: number | null;
  totalInstallments: number | null;
  isRecurring: boolean;
  occurredAt: string;
  account: {
    id: string;
    name: string;
  };
  transferAccount: {
    id: string;
    name: string;
  } | null;
  category: {
    id: string;
    name: string;
  } | null;
};

type TransactionsClientProps = {
  householdId: string;
  accounts: AccountOption[];
  categories: CategoryOption[];
};

type Filters = {
  type: string;
  categoryId: string;
  from: string;
  to: string;
};

const transactionTypeLabels: Record<TransactionType, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  TRANSFER: "Transferencia",
  ADJUSTMENT: "Ajuste",
  DEBT_PAYMENT: "Pago de deuda",
  GOAL_CONTRIBUTION: "Aporte a meta",
  INVESTMENT: "Inversión",
};

const transactionTypes = Object.keys(transactionTypeLabels) as TransactionType[];
const supportedFormTransactionTypes = ["INCOME", "EXPENSE", "TRANSFER", "ADJUSTMENT"] as const;
const transactionIcons = {
  INCOME: ArrowUpCircle,
  EXPENSE: ArrowDownCircle,
  TRANSFER: ArrowRightLeft,
  ADJUSTMENT: ArrowDownCircle,
  DEBT_PAYMENT: ArrowDownCircle,
  GOAL_CONTRIBUTION: ArrowDownCircle,
  INVESTMENT: ArrowDownCircle,
} satisfies Record<TransactionType, typeof ArrowDownCircle>;

const expenseTypeLabels: Record<ExpenseType, string> = {
  FIXED: "Fijo",
  VARIABLE: "Variable",
  EXTRAORDINARY: "Extraordinario",
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  DEBIT: "Débito",
  CREDIT: "Crédito",
  TRANSFER: "Transferencia",
};

const transactionOriginLabels: Record<TransactionOrigin, string> = {
  MANUAL: "Manual",
  CARD_SUMMARY: "Resumen tarjeta",
  BANK: "Banco",
  MERCADO_PAGO: "Mercado Pago",
};

const formSchema = z.object({
  type: z.enum(transactionTypes as [TransactionType, ...TransactionType[]]),
  accountId: z.string().min(1, "Seleccioná una cuenta."),
  transferAccountId: z.string().optional(),
  categoryId: z.string().optional(),
  currency: z.enum(["ARS", "USD"]),
  amount: moneySchema(),
  occurredAt: z.string().min(1, "Seleccioná una fecha."),
  description: z.string().trim().min(2, "Agregá una descripción.").max(160),
  notes: z.string().trim().max(1000).optional(),
  expenseType: z.enum(["FIXED", "VARIABLE", "EXTRAORDINARY"] as [ExpenseType, ...ExpenseType[]]).optional(),
  paymentMethod: z.enum(["CASH", "DEBIT", "CREDIT", "TRANSFER"] as [PaymentMethod, ...PaymentMethod[]]).optional(),
  isInstallment: z.boolean().default(false),
  installmentNumber: z.coerce.number().int().positive().optional(),
  totalInstallments: z.coerce.number().int().positive().optional(),
  isRecurring: z.boolean().default(false),
}).superRefine((data, ctx) => {
  if (data.type === "TRANSFER") {
    if (!data.transferAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Seleccioná la cuenta destino.", path: ["transferAccountId"] });
    } else if (data.transferAccountId === data.accountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La cuenta destino debe ser diferente.", path: ["transferAccountId"] });
    }
  }
  if (data.isInstallment) {
    if (!data.installmentNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ingresá el número de cuota.", path: ["installmentNumber"] });
    }
    if (!data.totalInstallments) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ingresá el total de cuotas.", path: ["totalInstallments"] });
    }
  }
});

export function TransactionsClient({ householdId, accounts, categories }: TransactionsClientProps) {
  const searchParams = useSearchParams();
  const defaultAccount = getPreferredArsBankAccount(accounts);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>({
    type: searchParams.get("type") ?? "",
    categoryId: searchParams.get("categoryId") ?? "",
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
  });
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    control,
    formState: { errors: formErrors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "EXPENSE" as TransactionType,
      accountId: defaultAccount?.id ?? "",
      transferAccountId: "",
      categoryId: "",
      currency: (defaultAccount?.currency ?? "ARS") as CurrencyCode,
      amount: "",
      occurredAt: formatArgentinaDateInput(),
      description: "",
      notes: "",
      expenseType: undefined as ExpenseType | undefined,
      paymentMethod: "DEBIT" as PaymentMethod,
      isInstallment: false,
      installmentNumber: undefined as number | undefined,
      totalInstallments: undefined as number | undefined,
      isRecurring: false,
    },
  });
  const watchedType = (useWatch({ control, name: "type" }) as TransactionType | undefined) ?? "EXPENSE";
  const watchedAccountId = (useWatch({ control, name: "accountId" }) as string | undefined) ?? "";
  const watchedIsInstallment = (useWatch({ control, name: "isInstallment" }) as boolean | undefined) ?? false;
  const watchedPaymentMethod = (useWatch({ control, name: "paymentMethod" }) as PaymentMethod | undefined);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(() => (
    Boolean(searchParams.get("type") ?? searchParams.get("categoryId") ?? searchParams.get("from") ?? searchParams.get("to"))
  ));
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const filteredCategories = useMemo(() => {
    return categories.filter((category) => isCategoryAllowedForType(category.type, watchedType));
  }, [categories, watchedType]);

  const groupedTransactions = useMemo(() => {
    return groupTransactionsByDate(transactions);
  }, [transactions]);

  const totalAmount = useMemo(() => {
    return transactions.reduce((sum, transaction) => sum + getSignedAmount(transaction), 0);
  }, [transactions]);
  const activeFilterCount = [filters.type, filters.categoryId, filters.from, filters.to].filter(Boolean).length;

  useEffect(() => {
    void loadTransactions(filters, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadTransactions(filtersRef.current, search);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      resetForm();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsFormOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function loadTransactions(
    nextFilters = filters,
    nextSearch = search,
    options: { append?: boolean; cursor?: string | null } = {},
  ) {
    const { append = false, cursor = null } = options;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setNextCursor(null);
      setHasMore(false);
    }
    setMessage(null);

    try {
      const params = new URLSearchParams({ householdId, limit: "50" });

      if (nextFilters.type) params.set("type", nextFilters.type);
      if (nextFilters.categoryId) params.set("categoryId", nextFilters.categoryId);
      if (nextFilters.from) params.set("from", nextFilters.from);
      if (nextFilters.to) params.set("to", nextFilters.to);
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      if (cursor) params.set("cursor", cursor);

      const response = await fetch(`/api/transactions?${params.toString()}`);
      const payload = (await response.json()) as {
        data?: { data: TransactionItem[]; hasMore: boolean; nextCursor: string | null };
        error?: string;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "No se pudieron cargar las transacciones.");
        return;
      }

      if (payload.data) {
        setTransactions((prev) => append ? [...prev, ...payload.data!.data] : payload.data!.data);
        setHasMore(payload.data.hasMore);
        setNextCursor(payload.data.nextCursor);
      }
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  async function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadTransactions(filters, search);
  }

  async function onTransactionSubmit(data: Record<string, unknown>) {
    setMessage(null);
    setIsSaving(true);

    try {
      const url = editingTransactionId
        ? `/api/transactions/${editingTransactionId}`
        : "/api/transactions";

      const type = data.type as TransactionType;
      const isNonBasicEdit = !!editingTransactionId && !isSupportedFormTransactionType(type);

      const isExpenseOrIncome = type === "EXPENSE" || type === "INCOME";
      const body = isNonBasicEdit
        ? {
            householdId,
            amount: data.amount,
            occurredAt: data.occurredAt,
            description: data.description,
            notes: (data.notes as string) || null,
          }
        : {
            householdId,
            type,
            accountId: data.accountId,
            transferAccountId: type === "TRANSFER" ? ((data.transferAccountId as string) || undefined) : undefined,
            categoryId: (data.categoryId as string) || (editingTransactionId ? null : undefined),
            currency: data.currency,
            amount: data.amount,
            occurredAt: data.occurredAt,
            description: data.description,
            notes: editingTransactionId ? ((data.notes as string) ?? "") : (data.notes as string) || undefined,
            expenseType: type === "EXPENSE" ? ((data.expenseType as string) || null) : null,
            paymentMethod: isExpenseOrIncome ? ((data.paymentMethod as string) || null) : null,
            isInstallment: isExpenseOrIncome ? Boolean(data.isInstallment) : false,
            installmentNumber: isExpenseOrIncome && data.isInstallment ? (data.installmentNumber as number | undefined) : null,
            totalInstallments: isExpenseOrIncome && data.isInstallment ? (data.totalInstallments as number | undefined) : null,
            isRecurring: isExpenseOrIncome ? Boolean(data.isRecurring) : false,
          };

      const response = await fetch(url, {
        method: editingTransactionId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as {
        data?: TransactionItem;
        error?: string;
        fieldErrors?: Record<string, string>;
      };

      if (!response.ok) {
        if (payload.fieldErrors) {
          Object.entries(payload.fieldErrors).forEach(([field, message]) => {
            setError(field as Parameters<typeof setError>[0], { message });
          });
          setMessage(payload.error ?? "Revisá los campos marcados.");
        } else {
          setMessage(payload.error ?? "No se pudo guardar la transacción.");
        }
        return;
      }

      toast.success(editingTransactionId ? "Transacción actualizada." : "Transacción guardada.");
      resetForm();
      setIsFormOpen(false);
      await loadTransactions(filters, search);
    } catch {
      setMessage("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(transactionId: string) {
    const shouldDelete = window.confirm("¿Eliminar esta transacción? Esta acción usará soft delete.");

    if (!shouldDelete) {
      return;
    }

    setDeletingTransactionId(transactionId);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/transactions/${transactionId}?${new URLSearchParams({ householdId }).toString()}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(payload.error ?? "No se pudo eliminar la transacción.");
        return;
      }

      toast.success("Transacción eliminada.");
      if (editingTransactionId === transactionId) {
        resetForm();
        setIsFormOpen(false);
      }

      await loadTransactions(filters, search);
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setDeletingTransactionId(null);
    }
  }

  function startEditing(transaction: TransactionItem) {
    setEditingTransactionId(transaction.id);
    setIsFormOpen(true);
    setMessage(null);
    reset({
      type: transaction.type,
      accountId: transaction.account.id,
      transferAccountId: transaction.transferAccount?.id ?? "",
      categoryId: transaction.category?.id ?? "",
      currency: transaction.currency,
      amount: String(Number(transaction.amount)),
      occurredAt: transaction.occurredAt.slice(0, 10),
      description: transaction.description ?? "",
      notes: transaction.notes ?? "",
      expenseType: transaction.expenseType ?? undefined,
      paymentMethod: transaction.paymentMethod ?? undefined,
      isInstallment: transaction.isInstallment,
      installmentNumber: transaction.installmentNumber ?? undefined,
      totalInstallments: transaction.totalInstallments ?? undefined,
      isRecurring: transaction.isRecurring,
    });
  }

  function resetForm() {
    setEditingTransactionId(null);
    reset({
      type: "EXPENSE",
      accountId: defaultAccount?.id ?? "",
      transferAccountId: "",
      categoryId: "",
      currency: (defaultAccount?.currency ?? "ARS") as CurrencyCode,
      amount: "",
      occurredAt: formatArgentinaDateInput(),
      description: "",
      notes: "",
      expenseType: undefined,
      paymentMethod: "DEBIT",
      isInstallment: false,
      installmentNumber: undefined,
      totalInstallments: undefined,
      isRecurring: false,
    });
  }

  function toggleGroup(label: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  function collapseAllGroups() {
    setCollapsedGroups(new Set(groupedTransactions.map((group) => group.label)));
  }

  function expandAllGroups() {
    setCollapsedGroups(new Set());
  }

  async function exportCsv() {
    const params = new URLSearchParams({ householdId });
    if (filters.type) params.set("type", filters.type);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (search.trim()) params.set("search", search.trim());

    try {
      const response = await fetch(`/api/transactions/export?${params.toString()}`);
      if (!response.ok) {
        toast.error("No se pudo exportar.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `transacciones-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Error de red al exportar.");
    }
  }

  return (
    <div className={`grid min-w-0 gap-6 ${isFormOpen ? "xl:grid-cols-[360px_1fr]" : ""}`}>
      <AppFormPanel isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} desktopAlwaysOpen={false}>
        <CardHeader className={appFormHeaderClass()}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>{editingTransactionId ? "Editar transacción" : "Nueva transacción"}</CardTitle>
              <CardDescription>
                {editingTransactionId ? "Actualizá los campos necesarios." : "Alta rápida con validación."}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Cerrar formulario"
              className="ml-auto xl:hidden"
              onClick={() => setIsFormOpen(false)}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className={appFormContentClass(isFormOpen)}>
          {accounts.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
                <p className="text-sm font-semibold text-foreground">Primero necesitás una cuenta</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Para registrar movimientos hace falta crear una cuenta, billetera o tarjeta.
                </p>
              </div>
              <Button asChild className="h-11 w-full">
                <Link href="/accounts">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Crear cuenta
                </Link>
              </Button>
            </div>
          ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onTransactionSubmit)}>
            {editingTransactionId && !isSupportedFormTransactionType(watchedType) ? (
              <Field label="Tipo">
                <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-secondary/30 px-3">
                  <Badge>{transactionTypeLabels[watchedType]}</Badge>
                  <span className="text-xs text-muted-foreground">Solo podés editar monto, fecha, descripción y notas.</span>
                </div>
              </Field>
            ) : (
              <Field label="Tipo" error={formErrors.type?.message}>
                <select
                  className="h-10 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register("type")}
                  onChange={(event) => {
                    setValue("type", event.target.value as TransactionType);
                    setValue("categoryId", "");
                  }}
                >
                  {supportedFormTransactionTypes.map((type) => (
                    <option key={type} value={type}>
                      {transactionTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label={watchedType === "TRANSFER" ? "Cuenta origen" : "Cuenta"} error={formErrors.accountId?.message}>
              <select
                className="h-10 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("accountId")}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.currency}
                  </option>
                ))}
              </select>
            </Field>

            {watchedType === "TRANSFER" && !editingTransactionId ? (
              <Field label="Cuenta destino" error={formErrors.transferAccountId?.message}>
                <select
                  className="h-10 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register("transferAccountId")}
                >
                  <option value="">Seleccioná cuenta destino</option>
                  {accounts.filter((a) => a.id !== watchedAccountId).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {account.currency}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {watchedType !== "TRANSFER" ? (
              <Field label="Categoría" error={formErrors.categoryId?.message}>
                <select
                  className="h-10 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register("categoryId")}
                >
                  <option value="">Sin categoría</option>
                  {filteredCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Moneda" error={formErrors.currency?.message}>
                <select
                  className="h-10 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register("currency")}
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
              <Field label="Monto" error={formErrors.amount?.message}>
                <Input
                  inputMode="decimal"
                  {...register("amount")}
                  placeholder="0"
                />
              </Field>
            </div>

            <Field label="Fecha" error={formErrors.occurredAt?.message}>
              <Input
                type="date"
                {...register("occurredAt")}
              />
            </Field>

            <Field label="Descripción" error={formErrors.description?.message}>
              <Input
                {...register("description")}
                placeholder="Ej: Compra supermercado"
              />
            </Field>

            <Field label="Notas" error={formErrors.notes?.message}>
              <textarea
                className="min-h-20 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("notes")}
                placeholder="Detalle opcional"
              />
            </Field>

            {(watchedType === "EXPENSE" || watchedType === "INCOME") && !editingTransactionId ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {watchedType === "EXPENSE" ? (
                    <Field label="Tipo de gasto" error={formErrors.expenseType?.message}>
                      <select
                        className="h-10 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        {...register("expenseType")}
                      >
                        <option value="">Sin clasificar</option>
                        {(Object.keys(expenseTypeLabels) as ExpenseType[]).map((et) => (
                          <option key={et} value={et}>{expenseTypeLabels[et]}</option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                  <Field label="Método de pago" error={formErrors.paymentMethod?.message}>
                    <select
                      className="h-10 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      {...register("paymentMethod")}
                    >
                      <option value="">Sin especificar</option>
                      {(Object.keys(paymentMethodLabels) as PaymentMethod[]).map((pm) => (
                        <option key={pm} value={pm}>{paymentMethodLabels[pm]}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input accent-primary"
                      {...register("isRecurring")}
                    />
                    Recurrente
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input accent-primary"
                      {...register("isInstallment")}
                    />
                    Es en cuotas
                  </label>
                </div>

                {watchedIsInstallment ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Cuota N°" error={formErrors.installmentNumber?.message}>
                      <Input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        {...register("installmentNumber")}
                        placeholder="Ej: 1"
                      />
                    </Field>
                    <Field label="Total cuotas" error={formErrors.totalInstallments?.message}>
                      <Input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        {...register("totalInstallments")}
                        placeholder="Ej: 12"
                      />
                    </Field>
                  </div>
                ) : null}
              </>
            ) : null}

            {message ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null}

            <div className={appFormActionsClass()}>
              <Button className="h-11 w-full" disabled={isSaving || accounts.length === 0}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {editingTransactionId ? "Guardar cambios" : "Guardar transacción"}
              </Button>
              {editingTransactionId ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => {
                    resetForm();
                    setIsFormOpen(false);
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
          )}
        </CardContent>
      </AppFormPanel>

      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader className="p-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  className="h-9 min-w-0 pl-8 text-xs"
                  placeholder="Buscar movimiento..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant={activeFilterCount > 0 ? "secondary" : "outline"}
                size="sm"
                className="h-9 shrink-0 px-2 text-xs sm:px-2.5"
                onClick={() => setIsFiltersOpen((current) => !current)}
                aria-expanded={isFiltersOpen}
              >
                <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                {activeFilterCount > 0 ? activeFilterCount : "Filtros"}
                <ChevronDown className={`h-3.5 w-3.5 transition ${isFiltersOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 shrink-0 px-2 text-xs sm:px-2.5"
                onClick={() => {
                  resetForm();
                  setIsFormOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Nueva
              </Button>
            </div>
          </CardHeader>
          {isFiltersOpen ? (
            <CardContent className="px-3 pb-3 pt-0">
              <form className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-5" onSubmit={handleFilterSubmit}>
                <Field label="Tipo">
                  <select
                    className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={filters.type}
                    onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
                  >
                    <option value="">Todos</option>
                    {transactionTypes.map((type) => (
                      <option key={type} value={type}>
                        {transactionTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Categoría">
                  <select
                    className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={filters.categoryId}
                    onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))}
                  >
                    <option value="">Todas</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Desde">
                  <Input
                    className="h-9 text-xs"
                    type="date"
                    value={filters.from}
                    onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                  />
                </Field>
                <Field label="Hasta">
                  <Input
                    className="h-9 text-xs"
                    type="date"
                    value={filters.to}
                    onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
                  />
                </Field>
                <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
                  <Button className="h-9 flex-1 text-xs" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                    Aplicar
                  </Button>
                  {activeFilterCount > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2 text-xs text-muted-foreground"
                      onClick={() => {
                        const nextFilters = { type: "", categoryId: "", from: "", to: "" };
                        setFilters(nextFilters);
                        void loadTransactions(nextFilters, search, { append: false });
                      }}
                    >
                      Limpiar
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle>Listado</CardTitle>
                <CardDescription>
                  {transactions.length} movimiento{transactions.length !== 1 ? "s" : ""} ·{" "}
                  <span className={totalAmount >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {totalAmount >= 0 ? "+" : ""}{formatMoneyBalance(totalAmount)}
                  </span>
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => void exportCsv()}
                disabled={transactions.length === 0}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                CSV
              </Button>
              <Button
                type="button"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  resetForm();
                  setIsFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nueva
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-2xl border border-border p-4 space-y-3">
                    <div className="flex gap-3">
                      <Skeleton className="h-11 w-11 rounded-2xl shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                      <Skeleton className="h-5 w-20 shrink-0" />
                    </div>
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/20 p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background text-muted-foreground shadow-sm">
                  <ReceiptText className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">{search ? "Sin resultados" : "Sin transacciones"}</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {search
                    ? "Ningún movimiento coincide con la búsqueda."
                    : "Creá el primer movimiento o ajustá los filtros para ver otros resultados."}
                </p>
                {!search ? (
                  <Button
                    type="button"
                    className="mt-5 inline-flex"
                    onClick={() => {
                      resetForm();
                      setIsFormOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Agregar primera transacción
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={collapseAllGroups}
                  >
                    Colapsar días
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={expandAllGroups}
                  >
                    Ver todos
                  </Button>
                </div>
                {groupedTransactions.map((group) => (
                  <TransactionGroup
                    key={group.label}
                    group={group}
                    isCollapsed={collapsedGroups.has(group.label)}
                    deletingTransactionId={deletingTransactionId}
                    onToggle={() => toggleGroup(group.label)}
                    onEdit={startEditing}
                    onDelete={handleDelete}
                  />
                ))}

                {hasMore && (
                  <div className="flex justify-center pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isLoadingMore}
                      onClick={() => loadTransactions(filters, search, { append: true, cursor: nextCursor })}
                    >
                      {isLoadingMore ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : null}
                      {isLoadingMore ? "Cargando..." : "Cargar más"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <MobileCreateFab
        label="Nueva transacción"
        onClick={() => {
          resetForm();
          setIsFormOpen(true);
        }}
      />
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
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function TransactionGroup({
  group,
  isCollapsed,
  deletingTransactionId,
  onToggle,
  onEdit,
  onDelete,
}: {
  group: ReturnType<typeof groupTransactionsByDate>[number];
  isCollapsed: boolean;
  deletingTransactionId: string | null;
  onToggle: () => void;
  onEdit: (transaction: TransactionItem) => void;
  onDelete: (transactionId: string) => void;
}) {
  return (
    <section className="space-y-1.5">
      <button
        type="button"
        className="sticky top-2 z-10 flex w-full items-center justify-between rounded-full border border-border bg-background/90 px-3 py-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground shadow-sm backdrop-blur transition hover:bg-secondary"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
      >
        <span className="flex items-center gap-2">
          <ChevronRight className={`h-3.5 w-3.5 transition ${isCollapsed ? "" : "rotate-90"}`} aria-hidden="true" />
          {group.label}
        </span>
        <span>{group.transactions.length}</span>
      </button>
      {!isCollapsed ? (
        <div className="space-y-1.5">
          {group.transactions.map((transaction) => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction}
              isDeleting={deletingTransactionId === transaction.id}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TransactionCard({
  transaction,
  isDeleting,
  onEdit,
  onDelete,
}: {
  transaction: TransactionItem;
  isDeleting: boolean;
  onEdit: (transaction: TransactionItem) => void;
  onDelete: (transactionId: string) => void;
}) {
  const Icon = transactionIcons[transaction.type];
  const tone = getTransactionTone(transaction.type);
  const signedAmount = getSignedAmount(transaction);
  const displayAmount = getDisplayAmount(transaction);
  const isTransfer = transaction.type === "TRANSFER";

  return (
    <article
      className="group min-w-0 cursor-pointer overflow-hidden rounded-lg border border-border bg-card px-2.5 py-2 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md active:scale-[0.99]"
      role="button"
      tabIndex={0}
      onClick={() => onEdit(transaction)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit(transaction);
        }
      }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold sm:text-sm">{transaction.description ?? "Sin descripción"}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {transaction.type === "TRANSFER"
                  ? `${transaction.account.name}${transaction.transferAccount ? ` → ${transaction.transferAccount.name}` : ""}`
                  : `${transaction.category?.name ?? "Sin categoría"} · ${transaction.account.name}`}
              </p>
            </div>
            <div className="max-w-[42%] shrink-0 text-right">
              <p className={`max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold leading-none sm:text-sm ${tone.amount}`}>
                {isTransfer ? "" : signedAmount > 0 ? "+" : signedAmount < 0 ? "-" : ""}
                {formatMoney(isTransfer ? displayAmount : Math.abs(signedAmount), transaction.currency)}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{transaction.currency}</p>
            </div>
          </div>

          <div className="mt-1.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
            <Badge className={`h-5 shrink-0 border-0 px-2 text-[11px] ${tone.badge}`}>{transactionTypeLabels[transaction.type]}</Badge>
            {transaction.status === "PENDING" && (
              <Badge className="h-5 shrink-0 border-amber-500/30 bg-amber-500/10 px-2 text-[11px] text-amber-400">Pendiente</Badge>
            )}
            {transaction.status === "CANCELED" && (
              <Badge className="h-5 shrink-0 border-border bg-secondary px-2 text-[11px] text-muted-foreground line-through">Cancelada</Badge>
            )}
            <span className="inline-flex min-w-0 items-center gap-1 truncate rounded-md bg-secondary px-2 py-1 text-[11px] leading-none text-muted-foreground">
              <CalendarDays className="h-3 w-3" aria-hidden="true" />
              {formatDate(transaction.occurredAt)}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(transaction.id);
          }}
          disabled={isDeleting}
          aria-label="Eliminar transacción"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </article>
  );
}

function groupTransactionsByDate(transactions: TransactionItem[]) {
  const groups = new Map<string, TransactionItem[]>();

  transactions.forEach((transaction) => {
    const label = getDateGroupLabel(transaction.occurredAt);
    groups.set(label, [...(groups.get(label) ?? []), transaction]);
  });

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    transactions: items,
  }));
}

function getDateGroupLabel(value: string) {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  const date = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = today - 86_400_000;
  const weekStart = today - (((now.getDay() + 6) % 7) * 86_400_000);

  if (date === today) return "Hoy";
  if (date === yesterday) return "Ayer";
  if (date >= weekStart && date < yesterday) return "Esta semana";

  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

function getTransactionTone(type: TransactionType) {
  if (type === "INCOME") {
    return {
      icon: "bg-emerald-500/15 text-emerald-500",
      amount: "text-emerald-500",
      badge: "bg-emerald-500/10 text-emerald-500",
    };
  }

  if (type === "TRANSFER") {
    return {
      icon: "bg-sky-500/15 text-sky-500",
      amount: "text-sky-500",
      badge: "bg-sky-500/10 text-sky-500",
    };
  }

  return {
    icon: "bg-rose-500/15 text-rose-500",
    amount: "text-rose-500",
    badge: "bg-rose-500/10 text-rose-500",
  };
}

function getSignedAmount(transaction: TransactionItem) {
  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount)) return 0;
  if (transaction.type === "INCOME") return amount;
  if (transaction.type === "TRANSFER") return 0;
  return -amount;
}

function getDisplayAmount(transaction: TransactionItem) {
  const amount = Number(transaction.amount);
  if (!Number.isFinite(amount)) return 0;
  return amount;
}

function isCategoryAllowedForType(categoryType: CategoryType, transactionType: TransactionType) {
  if (transactionType === "INCOME") {
    return categoryType === "INCOME";
  }

  if (transactionType === "EXPENSE") {
    return categoryType === "EXPENSE";
  }

  if (transactionType === "DEBT_PAYMENT") {
    return categoryType === "DEBT";
  }

  if (transactionType === "GOAL_CONTRIBUTION") {
    return categoryType === "GOAL";
  }

  if (transactionType === "INVESTMENT") {
    return categoryType === "INVESTMENT";
  }

  return categoryType === "TRANSFER" || categoryType === "ADJUSTMENT";
}

function isSupportedFormTransactionType(type: TransactionType) {
  return supportedFormTransactionTypes.includes(
    type as (typeof supportedFormTransactionTypes)[number],
  );
}

function formatMoney(value: string | number, currency: CurrencyCode) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatMoneyBalance(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
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
