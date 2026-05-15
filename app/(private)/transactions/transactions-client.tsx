"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CreditCard,
  Loader2,
  Plus,
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
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { formatArgentinaDateInput } from "@/lib/dates";
import { onIntegerKeyDown, onMoneyKeyDown } from "@/lib/input-utils";
import { moneySchema } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  expenseTypeLabels,
  paymentMethodLabels,
  supportedFormTransactionTypes,
  transactionSelectClass,
  transactionTypeLabels,
  transactionTypes,
} from "./constants";
import { DeleteTransactionDialog } from "./delete-transaction-dialog";
import { Field } from "./field";
import { SplitEditor } from "./split-editor";
import { TransactionFilters } from "./transaction-filters";
import { TransactionList } from "./transaction-list";
import type {
  AccountOption,
  CategoryOption,
  CurrencyCode,
  ExpenseType,
  Filters,
  PaymentMethod,
  TransactionItem,
  TransactionType,
  TransactionsClientProps,
} from "./types";
import { useTransactionSplits } from "./use-transaction-splits";
import {
  buildFeedSummary,
  detectCurrencyMismatch,
  formatDate,
  formatMoney,
  formatMoneyBalance,
  getDisplayAmount,
  getHighestDebtCreditCard,
  getPreferredArsBankAccount,
  getSignedAmount,
  getTransactionTone,
  groupTransactionsByDate,
  isCategoryAllowedForType,
  isSupportedFormTransactionType,
  optionalPayloadValue,
  sortAccountsByCurrency,
} from "./utils";

const optionalEnumField = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((value) => value === "" ? undefined : value, z.enum(values).optional());

const CARD_PAYMENT_KEYWORDS = [
  "pago tarjeta", "pago de tarjeta", "abono tarjeta",
  "pagar tarjeta", "saldar tarjeta", "pago visa",
  "pago master", "pago amex", "pago crédito", "pago credito",
];

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
  expenseType: optionalEnumField(["FIXED", "VARIABLE", "EXTRAORDINARY"]),
  paymentMethod: optionalEnumField(["CASH", "DEBIT", "CREDIT", "TRANSFER"]),
  isInstallment: z.boolean().default(false),
  installmentNumber: z.coerce.number().int().positive().optional(),
  totalInstallments: z.coerce.number().int().positive().optional(),
  isRecurring: z.boolean().default(false),
  sharedHouseholdId: z.string().optional(),
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

export function TransactionsClient({ householdId, accounts, categories, sharedHouseholds }: TransactionsClientProps) {
  const router = useRouter();
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
      sharedHouseholdId: "",
    },
  });
  const watchedType = (useWatch({ control, name: "type" }) as TransactionType | undefined) ?? "EXPENSE";
  const watchedAccountId = (useWatch({ control, name: "accountId" }) as string | undefined) ?? "";
  const watchedTransferAccountId = (useWatch({ control, name: "transferAccountId" }) as string | undefined) ?? "";
  const watchedDescription = (useWatch({ control, name: "description" }) as string | undefined) ?? "";
  const watchedIsInstallment = (useWatch({ control, name: "isInstallment" }) as boolean | undefined) ?? false;
  const watchedPaymentMethod = (useWatch({ control, name: "paymentMethod" }) as PaymentMethod | undefined);
  const watchedSharedHouseholdId = (useWatch({ control, name: "sharedHouseholdId" }) as string | undefined) ?? "";
  const watchedAmountStr = (useWatch({ control, name: "amount" }) as string | undefined) ?? "";
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const pendingCreateRequestIdRef = useRef<string | null>(null);
  const loadRequestSeqRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [cardPaymentMode, setCardPaymentMode] = useState<"total" | "parcial" | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [pendingDeleteTransaction, setPendingDeleteTransaction] = useState<TransactionItem | null>(null);
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

  const creditCardAccounts = useMemo(() => accounts.filter((a) => a.type === "CREDIT_CARD"), [accounts]);
  const selectedAccount = useMemo(() => accounts.find((a) => a.id === watchedAccountId), [accounts, watchedAccountId]);
  const transferTargetAccount = useMemo(() => accounts.find((a) => a.id === watchedTransferAccountId), [accounts, watchedTransferAccountId]);

  const isPotentialCardPayment = useMemo(() => (
    watchedType === "EXPENSE" &&
    selectedAccount?.type === "CREDIT_CARD" &&
    CARD_PAYMENT_KEYWORDS.some((kw) => watchedDescription.toLowerCase().includes(kw))
  ), [watchedType, selectedAccount, watchedDescription]);

  const isTransferToCreditCard = watchedType === "TRANSFER" && transferTargetAccount?.type === "CREDIT_CARD";

  const isCurrencyMismatch = useMemo(() =>
    watchedType === "TRANSFER" && Boolean(watchedTransferAccountId) && detectCurrencyMismatch(selectedAccount, transferTargetAccount),
  [watchedType, watchedTransferAccountId, selectedAccount, transferTargetAccount]);

  const isCCCurrencyMismatch = isTransferToCreditCard && detectCurrencyMismatch(selectedAccount, transferTargetAccount);

  const sortedTransferDestAccounts = useMemo(() => {
    const others = accounts.filter((a) => a.id !== watchedAccountId);
    return selectedAccount ? sortAccountsByCurrency(others, selectedAccount.currency as CurrencyCode) : others;
  }, [accounts, watchedAccountId, selectedAccount]);

  const cardPendingAmount = useMemo(() => {
    if (!transferTargetAccount?.currentBalance) return 0;
    const balance = parseFloat(transferTargetAccount.currentBalance);
    return isNaN(balance) ? 0 : Math.max(0, -balance);
  }, [transferTargetAccount]);

  const targetCurrency = (transferTargetAccount?.currency ?? "ARS") as CurrencyCode;

  const cardPartialPaymentCopy = useMemo(() => {
    if (!isTransferToCreditCard || cardPaymentMode !== "parcial") return null;
    const amount = parseFloat(watchedAmountStr);
    if (!amount || amount <= 0) return null;
    if (cardPendingAmount > 0 && amount > cardPendingAmount * 1.05) return "overpay";
    return "partial";
  }, [isTransferToCreditCard, cardPaymentMode, watchedAmountStr, cardPendingAmount]);

  const selectedHousehold = useMemo(
    () => sharedHouseholds.find((h) => h.id === watchedSharedHouseholdId),
    [sharedHouseholds, watchedSharedHouseholdId],
  );
  const {
    splitMode,
    splitValues,
    splitTotal,
    splitIsValid,
    setSplitMode,
    setSplitValues,
    resetSplits,
  } = useTransactionSplits({
    selectedHousehold,
    sharedHouseholdId: watchedSharedHouseholdId,
    amount: watchedAmountStr,
  });

  const groupedTransactions = useMemo(() => {
    return groupTransactionsByDate(transactions);
  }, [transactions]);

  const totalAmount = useMemo(() => {
    return transactions.reduce((sum, transaction) => sum + getSignedAmount(transaction), 0);
  }, [transactions]);
  const feedSummary = useMemo(() => buildFeedSummary(transactions), [transactions]);
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
    // Only process ?new=1 once on mount to prevent unexpected form resets
    // when searchParams change due to navigation or URL updates.
    if (searchParams.get("new") === "1") {
      resetForm();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsFormOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTransactions(
    nextFilters = filters,
    nextSearch = search,
    options: { append?: boolean; cursor?: string | null } = {},
  ) {
    const { append = false, cursor = null } = options;
    const requestSeq = ++loadRequestSeqRef.current;

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

      if (loadRequestSeqRef.current !== requestSeq) return;

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
      if (loadRequestSeqRef.current !== requestSeq) return;
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      if (loadRequestSeqRef.current === requestSeq) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
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
      const isEditing = Boolean(editingTransactionId);

      const isExpenseOrIncome = type === "EXPENSE" || type === "INCOME";
      const clientRequestId = editingTransactionId
        ? undefined
        : (pendingCreateRequestIdRef.current ??= crypto.randomUUID());
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
            clientRequestId,
            type,
            accountId: data.accountId,
            transferAccountId: type === "TRANSFER" ? ((data.transferAccountId as string) || undefined) : undefined,
            categoryId: (data.categoryId as string) || (editingTransactionId ? null : undefined),
            currency: data.currency,
            amount: data.amount,
            occurredAt: data.occurredAt,
            description: data.description,
            notes: editingTransactionId ? ((data.notes as string) ?? "") : (data.notes as string) || undefined,
            expenseType: type === "EXPENSE"
              ? optionalPayloadValue(data.expenseType, isEditing)
              : optionalPayloadValue(undefined, isEditing),
            paymentMethod: isExpenseOrIncome
              ? optionalPayloadValue(data.paymentMethod, isEditing)
              : optionalPayloadValue(undefined, isEditing),
            isInstallment: isExpenseOrIncome ? Boolean(data.isInstallment) : false,
            installmentNumber: isExpenseOrIncome && data.isInstallment
              ? optionalPayloadValue(data.installmentNumber, isEditing)
              : optionalPayloadValue(undefined, isEditing),
            totalInstallments: isExpenseOrIncome && data.isInstallment
              ? optionalPayloadValue(data.totalInstallments, isEditing)
              : optionalPayloadValue(undefined, isEditing),
            isRecurring: isExpenseOrIncome ? Boolean(data.isRecurring) : false,
            sharedHouseholdId: !editingTransactionId && type === "EXPENSE"
              ? ((data.sharedHouseholdId as string) || undefined)
              : undefined,
            splitConfig:
              !editingTransactionId && type === "EXPENSE" && (data.sharedHouseholdId as string) && splitMode !== "EQUAL"
                ? {
                    mode: splitMode,
                    participants: (selectedHousehold?.members ?? []).map((m) => ({
                      userId: m.userProfileId,
                      value: parseFloat(splitValues[m.userProfileId] || "0"),
                    })),
                  }
                : undefined,
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
        pendingCreateRequestIdRef.current = null;
        return;
      }

      const wasCardPayment = type === "TRANSFER" &&
        accounts.find((a) => a.id === (data.transferAccountId as string))?.type === "CREDIT_CARD";
      toast.success(editingTransactionId ? "Transacción actualizada." : "Transacción guardada.");
      pendingCreateRequestIdRef.current = null;
      resetForm();
      setIsFormOpen(false);
      await loadTransactions(filters, search);
      if (wasCardPayment) router.refresh();
    } catch {
      pendingCreateRequestIdRef.current = null;
      setMessage("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(transaction: TransactionItem) {
    setPendingDeleteTransaction(transaction);
  }

  async function confirmDelete() {
    if (!pendingDeleteTransaction) return;

    const transactionId = pendingDeleteTransaction.id;
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

      setPendingDeleteTransaction(null);
      await loadTransactions(filters, search);
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setDeletingTransactionId(null);
    }
  }

  function startEditing(transaction: TransactionItem) {
    setEditingTransactionId(transaction.id);
    setCardPaymentMode(null);
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
      sharedHouseholdId: transaction.sharedTransaction?.householdId ?? "",
    });
  }

  function resetForm() {
    setEditingTransactionId(null);
    setCardPaymentMode(null);
    resetSplits();
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
      sharedHouseholdId: "",
    });
  }

  function openCreditCardPaymentForm() {
    const destAccount = getHighestDebtCreditCard(creditCardAccounts);
    const nonCCAccounts = accounts.filter((a) => a.type !== "CREDIT_CARD");
    const sourceAccount =
      nonCCAccounts.find((a) => a.currency === destAccount?.currency) ??
      nonCCAccounts[0] ??
      accounts[0];
    setEditingTransactionId(null);
    setCardPaymentMode(null);
    resetSplits();
    reset({
      type: "TRANSFER",
      accountId: sourceAccount?.id ?? defaultAccount?.id ?? "",
      transferAccountId: destAccount?.id ?? "",
      categoryId: "",
      currency: (sourceAccount?.currency ?? destAccount?.currency ?? "ARS") as CurrencyCode,
      amount: "",
      occurredAt: formatArgentinaDateInput(),
      description: "Pago tarjeta",
      notes: "",
      expenseType: undefined,
      paymentMethod: undefined,
      isInstallment: false,
      installmentNumber: undefined,
      totalInstallments: undefined,
      isRecurring: false,
      sharedHouseholdId: "",
    });
    setIsFormOpen(true);
  }

  function convertToCardPaymentTransfer() {
    const ccAccount = accounts.find((a) => a.id === watchedAccountId);
    const nonCCAccount =
      accounts.find((a) => a.type !== "CREDIT_CARD" && a.id !== watchedAccountId && a.currency === ccAccount?.currency) ??
      accounts.find((a) => a.type !== "CREDIT_CARD" && a.id !== watchedAccountId);
    setValue("type", "TRANSFER");
    setValue("transferAccountId", watchedAccountId);
    if (nonCCAccount) {
      setValue("accountId", nonCCAccount.id);
      setValue("currency", nonCCAccount.currency as CurrencyCode);
    }
    setValue("categoryId", "");
    setValue("expenseType", undefined as ExpenseType | undefined);
    setValue("paymentMethod", undefined as PaymentMethod | undefined);
    setCardPaymentMode(null);
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
      <DeleteTransactionDialog
        transaction={pendingDeleteTransaction}
        isDeleting={pendingDeleteTransaction ? deletingTransactionId === pendingDeleteTransaction.id : false}
        onCancel={() => setPendingDeleteTransaction(null)}
        onConfirm={() => void confirmDelete()}
      />

      <AppFormPanel isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} desktopAlwaysOpen={false}>
        <CardHeader className={appFormHeaderClass()}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] text-teal-100">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>{editingTransactionId ? "Ajustar movimiento" : "Nuevo movimiento"}</CardTitle>
              <CardDescription>
                {editingTransactionId ? "Corregí lo importante sin perder contexto." : "Registrá qué pasó y dejá que el sistema lo lea."}
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
              <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
                <p className="text-sm font-semibold text-foreground">Primero necesitás una cuenta</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Para registrar movimientos hace falta crear una cuenta, billetera o tarjeta.
                </p>
              </div>
              <Button asChild className="h-11 w-full">
                <Link href="/accounts">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Crear lugar
                </Link>
              </Button>
            </div>
          ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onTransactionSubmit)}>
            {editingTransactionId && !isSupportedFormTransactionType(watchedType) ? (
              <Field label="Tipo">
                <div className="flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4">
                  <Badge>{transactionTypeLabels[watchedType]}</Badge>
                  <span className="text-xs text-muted-foreground">Solo podés editar monto, fecha, descripción y notas.</span>
                </div>
              </Field>
            ) : (
              <Field label="Tipo" error={formErrors.type?.message}>
                <select
                  className={transactionSelectClass}
                  {...register("type")}
                  onChange={(event) => {
                    setValue("type", event.target.value as TransactionType);
                    setValue("categoryId", "");
                    setCardPaymentMode(null);
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
                className={transactionSelectClass}
                {...register("accountId")}
                onChange={(event) => {
                  const newId = event.target.value;
                  setValue("accountId", newId);
                  const account = accounts.find((a) => a.id === newId);
                  if (account) setValue("currency", account.currency as CurrencyCode);
                }}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.currency}
                  </option>
                ))}
              </select>
            </Field>

            {watchedType === "TRANSFER" && !editingTransactionId ? (
              <>
                <Field label="Cuenta destino" error={formErrors.transferAccountId?.message}>
                  <select
                    className={transactionSelectClass}
                    {...register("transferAccountId")}
                    onChange={(event) => {
                      const newId = event.target.value;
                      setValue("transferAccountId", newId);
                      setCardPaymentMode(null);
                      const dst = accounts.find((a) => a.id === newId);
                      if (dst && dst.currency === selectedAccount?.currency) {
                        setValue("currency", dst.currency as CurrencyCode);
                      }
                    }}
                  >
                    <option value="">Seleccioná cuenta destino</option>
                    {sortedTransferDestAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {account.currency}
                      </option>
                    ))}
                  </select>
                </Field>
                {isTransferToCreditCard ? (
                  <div className="space-y-3 rounded-2xl border border-teal-300/20 bg-teal-400/10 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 shrink-0 text-teal-400" aria-hidden="true" />
                        <span className="text-xs font-semibold text-teal-100">Pago de tarjeta</span>
                      </div>
                      {cardPendingAmount > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Saldo pendiente: <SensitiveAmount value={formatMoney(cardPendingAmount, targetCurrency)} />
                        </span>
                      ) : null}
                    </div>
                    {cardPendingAmount <= 0 ? (
                      <p className="text-xs text-teal-100/70">Esta tarjeta no tiene saldo pendiente.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCardPaymentMode("total");
                            setValue("amount", String(cardPendingAmount));
                          }}
                          className={cn(
                            "rounded-xl border px-3 py-2.5 text-left text-xs transition",
                            cardPaymentMode === "total"
                              ? "border-teal-400/60 bg-teal-400/20 text-teal-100"
                              : "border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07]",
                          )}
                        >
                          <span className="flex items-center gap-1.5 font-semibold">
                            <span className={cn(
                              "h-3 w-3 shrink-0 rounded-full border-2 transition",
                              cardPaymentMode === "total" ? "border-teal-400 bg-teal-400" : "border-white/30",
                            )} />
                            Pago total
                          </span>
                          <span className="mt-0.5 block text-muted-foreground">Deja la tarjeta en cero.</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCardPaymentMode("parcial");
                            setValue("amount", "");
                          }}
                          className={cn(
                            "rounded-xl border px-3 py-2.5 text-left text-xs transition",
                            cardPaymentMode === "parcial"
                              ? "border-amber-400/60 bg-amber-400/10 text-amber-100"
                              : "border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07]",
                          )}
                        >
                          <span className="flex items-center gap-1.5 font-semibold">
                            <span className={cn(
                              "h-3 w-3 shrink-0 rounded-full border-2 transition",
                              cardPaymentMode === "parcial" ? "border-amber-400 bg-amber-400" : "border-white/30",
                            )} />
                            Pago parcial
                          </span>
                          <span className="mt-0.5 block text-muted-foreground">Quedará saldo pendiente.</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            ) : null}

            {watchedType !== "TRANSFER" ? (
              <Field label="Categoría" error={formErrors.categoryId?.message}>
                <select
                  className={transactionSelectClass}
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
                  className={cn(transactionSelectClass, "cursor-default opacity-70")}
                  {...register("currency")}
                  disabled
                  title="La moneda se toma de la cuenta seleccionada."
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
              <Field label="Monto" error={formErrors.amount?.message}>
                <Input
                  inputMode="decimal"
                  onKeyDown={onMoneyKeyDown}
                  {...register("amount")}
                  placeholder="0"
                  disabled={isTransferToCreditCard && cardPaymentMode === "total"}
                  className={cn(isTransferToCreditCard && cardPaymentMode === "total" && "cursor-default opacity-60")}
                />
              </Field>
            </div>

            {isCCCurrencyMismatch ? (
              <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-xs text-rose-100">
                Elegí una cuenta en la misma moneda que la tarjeta ({transferTargetAccount?.currency}).
              </div>
            ) : isCurrencyMismatch ? (
              <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-xs text-rose-100">
                Las transferencias entre monedas distintas todavía no están disponibles. Elegí cuentas en la misma moneda.
              </div>
            ) : cardPartialPaymentCopy === "overpay" ? (
              <p className="text-xs text-amber-300/80">
                El monto supera el saldo de la tarjeta. Podés continuar si querés generar saldo a favor.
              </p>
            ) : cardPartialPaymentCopy === "partial" ? (
              <p className="text-xs text-muted-foreground">
                Quedará saldo pendiente en la tarjeta.
              </p>
            ) : null}

            <Field label="Fecha" error={formErrors.occurredAt?.message}>
              <Input
                type="date"
                {...register("occurredAt")}
              />
            </Field>

            <Field label="Descripción" error={formErrors.description?.message}>
              <Input
                maxLength={160}
                {...register("description")}
                placeholder="Ej: Compra supermercado"
              />
            </Field>

            {isPotentialCardPayment ? (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm font-semibold text-foreground">¿Estás pagando una tarjeta?</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Los pagos de tarjeta son transferencias, no gastos nuevos. Convertilo para que el saldo se actualice correctamente y no se duplique como deuda.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={convertToCardPaymentTransfer}
                    >
                      <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                      Convertir a transferencia
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <Field label="Notas" error={formErrors.notes?.message}>
              <textarea
                className="v2-focus-ring min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-base md:text-sm text-white outline-none transition hover:bg-white/[0.07]"
                maxLength={1000}
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
                        className={transactionSelectClass}
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
                      className={transactionSelectClass}
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
                        onKeyDown={onIntegerKeyDown}
                        {...register("installmentNumber")}
                        placeholder="Ej: 1"
                      />
                    </Field>
                    <Field label="Total cuotas" error={formErrors.totalInstallments?.message}>
                      <Input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        onKeyDown={onIntegerKeyDown}
                        {...register("totalInstallments")}
                        placeholder="Ej: 12"
                      />
                    </Field>
                  </div>
                ) : null}

                {watchedType === "EXPENSE" && sharedHouseholds.length > 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-input accent-primary"
                        checked={Boolean(watchedSharedHouseholdId)}
                        onChange={(event) => {
                          setValue("sharedHouseholdId", event.target.checked ? (sharedHouseholds[0]?.id ?? "") : "");
                          if (!event.target.checked) {
                            setSplitMode("EQUAL");
                            setSplitValues({});
                          }
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold text-foreground">Compartido con hogar</span>
                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                          Distribuí este gasto entre los miembros del hogar.
                        </span>
                      </span>
                    </label>

                    {watchedSharedHouseholdId ? (
                      <div className="mt-3 space-y-3">
                        {sharedHouseholds.length > 1 ? (
                          <select className={transactionSelectClass} {...register("sharedHouseholdId")}>
                            {sharedHouseholds.map((household) => (
                              <option key={household.id} value={household.id}>
                                {household.name} · {household.members.length} miembros
                              </option>
                            ))}
                          </select>
                        ) : null}

                        <SplitEditor
                          selectedHousehold={selectedHousehold}
                          splitMode={splitMode}
                          splitValues={splitValues}
                          splitTotal={splitTotal}
                          splitIsValid={splitIsValid}
                          amount={watchedAmountStr}
                          onModeChange={setSplitMode}
                          onValuesChange={setSplitValues}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}

            {message ? <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">{message}</p> : null}

            <div className={appFormActionsClass()}>
              <Button className="h-11 w-full" disabled={isSaving || accounts.length === 0 || isCurrencyMismatch || isCCCurrencyMismatch}>
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
        <TransactionFilters
          search={search}
          filters={filters}
          categories={categories}
          activeFilterCount={activeFilterCount}
          isFiltersOpen={isFiltersOpen}
          isLoading={isLoading}
          onSearchChange={setSearch}
          onFiltersChange={setFilters}
          onToggleFilters={() => setIsFiltersOpen((current) => !current)}
          onSubmit={handleFilterSubmit}
          onClearFilters={() => {
            const nextFilters = { type: "", categoryId: "", from: "", to: "" };
            setFilters(nextFilters);
            void loadTransactions(nextFilters, search, { append: false });
          }}
          onNew={() => {
            resetForm();
            setIsFormOpen(true);
          }}
          onPayCreditCard={creditCardAccounts.length > 0 ? openCreditCardPaymentForm : undefined}
        />

        <TransactionList
          transactions={transactions}
          isLoading={isLoading}
          search={search}
          totalAmount={totalAmount}
          feedSummary={feedSummary}
          activeFilterCount={activeFilterCount}
          groupedTransactions={groupedTransactions}
          collapsedGroups={collapsedGroups}
          deletingTransactionId={deletingTransactionId}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onCollapseAll={collapseAllGroups}
          onExpandAll={expandAllGroups}
          onToggleGroup={toggleGroup}
          onEdit={startEditing}
          onDelete={handleDelete}
          onLoadMore={() => void loadTransactions(filters, search, { append: true, cursor: nextCursor })}
          onExportCsv={() => void exportCsv()}
          onNew={() => {
            resetForm();
            setIsFormOpen(true);
          }}
        />
      </div>
      <MobileCreateFab
        label="Nuevo movimiento"
        onClick={() => {
          resetForm();
          setIsFormOpen(true);
        }}
      />
    </div>
  );
}
