"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  CalendarDays,
  Download,
  Pencil,
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

type TransactionItem = {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  currency: CurrencyCode;
  amount: string;
  description: string | null;
  notes: string | null;
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

type FormState = {
  type: TransactionType;
  accountId: string;
  transferAccountId: string;
  categoryId: string;
  currency: CurrencyCode;
  amount: string;
  occurredAt: string;
  description: string;
  notes: string;
};

type Filters = {
  type: string;
  categoryId: string;
  from: string;
  to: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

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
}).superRefine((data, ctx) => {
  if (data.type === "TRANSFER") {
    if (!data.transferAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Seleccioná la cuenta destino.", path: ["transferAccountId"] });
    } else if (data.transferAccountId === data.accountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La cuenta destino debe ser diferente.", path: ["transferAccountId"] });
    }
  }
});

export function TransactionsClient({ householdId, accounts, categories }: TransactionsClientProps) {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>({
    type: "",
    categoryId: "",
    from: "",
    to: "",
  });
  const [form, setForm] = useState<FormState>({
    type: "EXPENSE",
    accountId: accounts[0]?.id ?? "",
    transferAccountId: "",
    categoryId: "",
    currency: accounts[0]?.currency ?? "ARS",
    amount: "",
    occurredAt: formatArgentinaDateInput(),
    description: "",
    notes: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filteredCategories = useMemo(() => {
    return categories.filter((category) => isCategoryAllowedForType(category.type, form.type));
  }, [categories, form.type]);

  const displayedTransactions = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => t.description?.toLowerCase().includes(q));
  }, [transactions, search]);

  const groupedTransactions = useMemo(() => {
    return groupTransactionsByDate(displayedTransactions);
  }, [displayedTransactions]);

  const totalAmount = useMemo(() => {
    return displayedTransactions.reduce((sum, transaction) => sum + getSignedAmount(transaction), 0);
  }, [displayedTransactions]);

  useEffect(() => {
    void loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTransactions(nextFilters = filters) {
    setIsLoading(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({ householdId, limit: "100" });

      if (nextFilters.type) params.set("type", nextFilters.type);
      if (nextFilters.categoryId) params.set("categoryId", nextFilters.categoryId);
      if (nextFilters.from) params.set("from", nextFilters.from);
      if (nextFilters.to) params.set("to", nextFilters.to);

      const response = await fetch(`/api/transactions?${params.toString()}`);
      const payload = (await response.json()) as { data?: TransactionItem[]; error?: string };

      if (!response.ok) {
        toast.error(payload.error ?? "No se pudieron cargar las transacciones.");
        return;
      }

      setTransactions(payload.data ?? []);
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadTransactions(filters);
  }

  async function handleTransactionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const parsed = formSchema.safeParse(form);

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
      const url = editingTransactionId
        ? `/api/transactions/${editingTransactionId}`
        : "/api/transactions";

      const isNonBasicEdit =
        !!editingTransactionId && !isSupportedFormTransactionType(parsed.data.type);

      const body = isNonBasicEdit
        ? {
            householdId,
            amount: parsed.data.amount,
            occurredAt: parsed.data.occurredAt,
            description: parsed.data.description,
            notes: parsed.data.notes || null,
          }
        : {
            householdId,
            type: parsed.data.type,
            accountId: parsed.data.accountId,
            transferAccountId: parsed.data.type === "TRANSFER" ? (parsed.data.transferAccountId || undefined) : undefined,
            categoryId: parsed.data.categoryId || (editingTransactionId ? null : undefined),
            currency: parsed.data.currency,
            amount: parsed.data.amount,
            occurredAt: parsed.data.occurredAt,
            description: parsed.data.description,
            notes: editingTransactionId ? (parsed.data.notes ?? "") : parsed.data.notes || undefined,
          };

      const response = await fetch(url, {
        method: editingTransactionId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as { data?: TransactionItem; error?: string; fieldErrors?: FormErrors };

      if (!response.ok) {
        if (payload.fieldErrors) setErrors(payload.fieldErrors);
        setMessage(payload.error ?? "No se pudo guardar la transacción.");
        return;
      }

      toast.success(editingTransactionId ? "Transacción actualizada." : "Transacción guardada.");
      resetForm();
      setIsFormOpen(false);
      await loadTransactions(filters);
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

      await loadTransactions(filters);
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setDeletingTransactionId(null);
    }
  }

  function startEditing(transaction: TransactionItem) {
    setEditingTransactionId(transaction.id);
    setIsFormOpen(true);
    setErrors({});
    setMessage(null);
    setForm({
      type: transaction.type,
      accountId: transaction.account.id,
      transferAccountId: transaction.transferAccount?.id ?? "",
      categoryId: transaction.category?.id ?? "",
      currency: transaction.currency,
      amount: String(Number(transaction.amount)),
      occurredAt: transaction.occurredAt.slice(0, 10),
      description: transaction.description ?? "",
      notes: transaction.notes ?? "",
    });
  }

  function resetForm() {
    setEditingTransactionId(null);
    setErrors({});
    setForm({
      type: "EXPENSE",
      accountId: accounts[0]?.id ?? "",
      transferAccountId: "",
      categoryId: "",
      currency: accounts[0]?.currency ?? "ARS",
      amount: "",
      occurredAt: formatArgentinaDateInput(),
      description: "",
      notes: "",
    });
  }

  function updateForm<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "type" ? { categoryId: "" } : {}),
    }));
  }

  function exportCsv() {
    const header = ["Fecha", "Tipo", "Descripción", "Categoría", "Cuenta", "Moneda", "Monto"];
    const rows = displayedTransactions.map((t) => [
      t.occurredAt.slice(0, 10),
      transactionTypeLabels[t.type],
      t.description ?? "",
      t.category?.name ?? "",
      t.account.name,
      t.currency,
      (t.type === "INCOME" ? "" : "-") + Number(t.amount).toFixed(2),
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `transacciones-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
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
          <form className="space-y-4" onSubmit={handleTransactionSubmit}>
            {editingTransactionId && !isSupportedFormTransactionType(form.type) ? (
              <Field label="Tipo">
                <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-secondary/30 px-3">
                  <Badge>{transactionTypeLabels[form.type]}</Badge>
                  <span className="text-xs text-muted-foreground">Solo podés editar monto, fecha, descripción y notas.</span>
                </div>
              </Field>
            ) : (
              <Field label="Tipo" error={errors.type}>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.type}
                  onChange={(event) => updateForm("type", event.target.value as TransactionType)}
                >
                  {supportedFormTransactionTypes.map((type) => (
                    <option key={type} value={type}>
                      {transactionTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label={form.type === "TRANSFER" ? "Cuenta origen" : "Cuenta"} error={errors.accountId}>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.accountId}
                onChange={(event) => updateForm("accountId", event.target.value)}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.currency}
                  </option>
                ))}
              </select>
            </Field>

            {form.type === "TRANSFER" && !editingTransactionId ? (
              <Field label="Cuenta destino" error={errors.transferAccountId}>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.transferAccountId}
                  onChange={(event) => updateForm("transferAccountId", event.target.value)}
                >
                  <option value="">Seleccioná cuenta destino</option>
                  {accounts.filter((a) => a.id !== form.accountId).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {account.currency}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {form.type !== "TRANSFER" ? (
              <Field label="Categoría" error={errors.categoryId}>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.categoryId}
                  onChange={(event) => updateForm("categoryId", event.target.value)}
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
              <Field label="Monto" error={errors.amount}>
                <Input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => updateForm("amount", event.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>

            <Field label="Fecha" error={errors.occurredAt}>
              <Input
                type="date"
                value={form.occurredAt}
                onChange={(event) => updateForm("occurredAt", event.target.value)}
              />
            </Field>

            <Field label="Descripción" error={errors.description}>
              <Input
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
                placeholder="Ej: Compra supermercado"
              />
            </Field>

            <Field label="Notas" error={errors.notes}>
              <textarea
                className="min-h-20 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                placeholder="Detalle opcional"
              />
            </Field>

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
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                <Search className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle>Filtros</CardTitle>
                <CardDescription>Tipo, categoría y rango de fechas.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por descripción…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
            <form className="grid min-w-0 gap-3 md:grid-cols-5" onSubmit={handleFilterSubmit}>
              <select
                className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={filters.type}
                onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
              >
                <option value="">Todos los tipos</option>
                {transactionTypes.map((type) => (
                  <option key={type} value={type}>
                    {transactionTypeLabels[type]}
                  </option>
                ))}
              </select>

              <select
                className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={filters.categoryId}
                onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))}
              >
                <option value="">Todas las categorías</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <Input
                type="date"
                value={filters.from}
                onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
              />
              <Input
                type="date"
                value={filters.to}
                onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
              />
              <Button disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Aplicar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle>Listado</CardTitle>
                <CardDescription>
                  {displayedTransactions.length} movimiento{displayedTransactions.length !== 1 ? "s" : ""} ·{" "}
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
                onClick={exportCsv}
                disabled={displayedTransactions.length === 0}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Exportar CSV
              </Button>
              <Button
                type="button"
                size="sm"
                className="hidden xl:inline-flex"
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
            ) : displayedTransactions.length === 0 ? (
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
                {groupedTransactions.map((group) => (
                  <section key={group.label} className="space-y-3">
                    <div className="sticky top-2 z-10 flex items-center justify-between rounded-full border border-border bg-background/90 px-3 py-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground shadow-sm backdrop-blur">
                      <span>{group.label}</span>
                      <span>{group.transactions.length}</span>
                    </div>
                    <div className="space-y-3">
                      {group.transactions.map((transaction) => (
                        <TransactionCard
                          key={transaction.id}
                          transaction={transaction}
                          isDeleting={deletingTransactionId === transaction.id}
                          onEdit={startEditing}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </section>
                ))}
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
      className="group min-w-0 cursor-pointer overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md active:scale-[0.99]"
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
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{transaction.description ?? "Sin descripción"}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {transaction.type === "TRANSFER"
                  ? `${transaction.account.name}${transaction.transferAccount ? ` → ${transaction.transferAccount.name}` : ""}`
                  : `${transaction.category?.name ?? "Sin categoría"} · ${transaction.account.name}`}
              </p>
            </div>
            <div className="max-w-full text-left sm:shrink-0 sm:text-right">
              <p className={`max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold leading-none sm:text-base ${tone.amount}`}>
                {isTransfer ? "" : signedAmount > 0 ? "+" : signedAmount < 0 ? "-" : ""}
                {formatMoney(isTransfer ? displayAmount : Math.abs(signedAmount), transaction.currency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{transaction.currency}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge className={`border-0 ${tone.badge}`}>{transactionTypeLabels[transaction.type]}</Badge>
            {transaction.status === "PENDING" && (
              <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-400">Pendiente</Badge>
            )}
            {transaction.status === "CANCELED" && (
              <Badge className="border-border bg-secondary text-muted-foreground line-through">Cancelada</Badge>
            )}
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" aria-hidden="true" />
              {formatDate(transaction.occurredAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 border-t border-border pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-start text-muted-foreground"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(transaction);
          }}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Ver / editar
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
