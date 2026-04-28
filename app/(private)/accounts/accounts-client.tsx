"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AccountType = "CASH" | "BANK" | "CREDIT_CARD" | "DIGITAL_WALLET" | "SAVINGS" | "OTHER";
type CurrencyCode = "ARS" | "USD";

type AccountItem = {
  id: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  openingBalance: number;
  currentBalance: number;
  creditLimit: number | null;
  isArchived: boolean;
};

type AccountsClientProps = {
  householdId: string;
};

type FormState = {
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  openingBalance: string;
  creditLimit: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const accountTypeLabels: Record<AccountType, string> = {
  CASH: "Efectivo",
  BANK: "Cuenta bancaria",
  CREDIT_CARD: "Tarjeta de crédito",
  DIGITAL_WALLET: "Billetera digital",
  SAVINGS: "Cuenta de ahorro",
  OTHER: "Otro",
};

const accountTypes = Object.keys(accountTypeLabels) as AccountType[];

const formSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre.").max(80),
  type: z.enum(accountTypes as [AccountType, ...AccountType[]]),
  currency: z.enum(["ARS", "USD"]),
  openingBalance: z.coerce.number().finite(),
  creditLimit: z.coerce.number().finite().positive().optional(),
});

const defaultForm: FormState = {
  name: "",
  type: "BANK",
  currency: "ARS",
  openingBalance: "0",
  creditLimit: "",
};

export function AccountsClient({ householdId }: AccountsClientProps) {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [assets, setAssets] = useState(0);
  const [liabilities, setLiabilities] = useState(0);
  const [netWorth, setNetWorth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    void loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  async function loadAccounts() {
    setIsLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ householdId, includeArchived: String(showArchived) });
      const response = await fetch(`/api/accounts?${params}`);
      const payload = (await response.json()) as {
        data?: { accounts: AccountItem[]; assets: number; liabilities: number; netWorth: number };
        error?: string;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "No se pudieron cargar las cuentas.");
        return;
      }

      if (payload.data) {
        setAccounts(payload.data.accounts);
        setAssets(payload.data.assets);
        setLiabilities(payload.data.liabilities);
        setNetWorth(payload.data.netWorth);
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
      creditLimit: form.creditLimit || undefined,
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
      const url = editingAccountId ? `/api/accounts/${editingAccountId}` : "/api/accounts";
      const response = await fetch(url, {
        method: editingAccountId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId,
          name: parsed.data.name,
          type: parsed.data.type,
          currency: parsed.data.currency,
          openingBalance: parsed.data.openingBalance,
          creditLimit: parsed.data.creditLimit ?? null,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo guardar la cuenta.");
        return;
      }

      toast.success(editingAccountId ? "Cuenta actualizada." : "Cuenta creada.");
      resetForm();
      setIsFormOpen(false);
      await loadAccounts();
    } catch {
      setMessage("Error de red. Verificá tu conexión e intentá de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive(accountId: string, isArchived: boolean) {
    const action = isArchived ? "unarchive" : "archive";
    const label = isArchived ? "restaurar" : "archivar";
    if (!window.confirm(`¿Querés ${label} esta cuenta?`)) return;

    try {
      const params = new URLSearchParams({ householdId, action });
      const response = await fetch(`/api/accounts/${accountId}?${params}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(payload.error ?? `No se pudo ${label} la cuenta.`);
        return;
      }

      toast.success(`Cuenta ${isArchived ? "restaurada" : "archivada"}.`);
      await loadAccounts();
    } catch {
      toast.error("Error de red. Verificá tu conexión e intentá de nuevo.");
    }
  }

  function startEditing(account: AccountItem) {
    setEditingAccountId(account.id);
    setIsFormOpen(true);
    setErrors({});
    setMessage(null);
    setForm({
      name: account.name,
      type: account.type,
      currency: account.currency,
      openingBalance: String(account.openingBalance),
      creditLimit: account.creditLimit ? String(account.creditLimit) : "",
    });
  }

  function resetForm() {
    setEditingAccountId(null);
    setErrors({});
    setForm(defaultForm);
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const archivedAccounts = accounts.filter((a) => a.isArchived);

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      {isFormOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 xl:hidden"
          onClick={() => setIsFormOpen(false)}
        />
      ) : null}

      <Card
        className={`${
          isFormOpen
            ? "fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 max-h-[calc(100dvh-96px)] overflow-y-auto rounded-2xl animate-slide-up"
            : "hidden"
        } xl:block`}
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>{editingAccountId ? "Editar cuenta" : "Nueva cuenta"}</CardTitle>
              <CardDescription>
                {editingAccountId ? "Modificá los datos de la cuenta." : "Agregá una cuenta bancaria, efectivo o tarjeta."}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto xl:hidden"
              onClick={() => setIsFormOpen(false)}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className={isFormOpen ? "pb-0 xl:pb-5" : undefined}>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="Nombre" error={errors.name}>
              <Input
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="Ej: Cuenta Galicia, Efectivo, Visa"
              />
            </Field>

            <Field label="Tipo" error={errors.type}>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.type}
                onChange={(e) => updateForm("type", e.target.value as AccountType)}
              >
                {accountTypes.map((t) => (
                  <option key={t} value={t}>{accountTypeLabels[t]}</option>
                ))}
              </select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Moneda" error={errors.currency}>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.currency}
                  onChange={(e) => updateForm("currency", e.target.value as CurrencyCode)}
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
              <Field
                label={form.type === "CREDIT_CARD" ? "Saldo inicial (deuda en negativo)" : "Saldo inicial"}
                error={errors.openingBalance}
              >
                <Input
                  inputMode="decimal"
                  value={form.openingBalance}
                  onChange={(e) => updateForm("openingBalance", e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>

            {form.type === "CREDIT_CARD" && (
              <Field label="Límite de crédito" error={errors.creditLimit}>
                <Input
                  inputMode="decimal"
                  value={form.creditLimit}
                  onChange={(e) => updateForm("creditLimit", e.target.value)}
                  placeholder="Opcional"
                />
              </Field>
            )}

            {message ? (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{message}</p>
            ) : null}

            <div className="sticky bottom-0 -mx-5 grid gap-2 border-t border-border bg-card/95 p-5 backdrop-blur sm:grid-cols-2 xl:static xl:mx-0 xl:border-0 xl:bg-transparent xl:p-0 xl:backdrop-blur-none 2xl:grid-cols-2">
              <Button className="h-11 w-full" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {editingAccountId ? "Guardar cambios" : "Crear cuenta"}
              </Button>
              {editingAccountId ? (
                <Button type="button" variant="outline" className="h-11 w-full" onClick={resetForm}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancelar
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Activos" value={formatMoney(assets, "ARS")} tone="positive" />
          <SummaryCard label="Pasivos" value={formatMoney(liabilities, "ARS")} tone="danger" />
          <SummaryCard label="Patrimonio neto" value={formatMoney(netWorth, "ARS")} tone={netWorth >= 0 ? "default" : "warning"} highlight />
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Cuentas activas</CardTitle>
                <CardDescription>{activeAccounts.length} cuentas</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowArchived((v) => !v)}
                >
                  {showArchived ? "Ocultar archivadas" : "Ver archivadas"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => { resetForm(); setIsFormOpen(true); }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Nueva
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-24" />
                  </div>
                ))}
              </div>
            ) : activeAccounts.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Sin cuentas"
                description="Agregá tu primera cuenta para comenzar a registrar movimientos."
              />
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {activeAccounts.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    onEdit={() => startEditing(account)}
                    onArchive={() => handleArchive(account.id, account.isArchived)}
                  />
                ))}
              </div>
            )}

            {showArchived && archivedAccounts.length > 0 && (
              <div className="mt-6">
                <p className="mb-3 text-sm font-medium text-muted-foreground">Archivadas</p>
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border opacity-60">
                  {archivedAccounts.map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      onEdit={() => startEditing(account)}
                      onArchive={() => handleArchive(account.id, account.isArchived)}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Button
        type="button"
        size="icon"
        className="fixed bottom-24 right-4 z-30 h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-xl shadow-violet-500/30 xl:hidden"
        onClick={() => { resetForm(); setIsFormOpen(true); }}
        aria-label="Nueva cuenta"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </Button>
    </div>
  );
}

function AccountRow({
  account,
  onEdit,
  onArchive,
}: {
  account: AccountItem;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const typeLabels: Record<AccountType, string> = {
    CASH: "Efectivo",
    BANK: "Banco",
    CREDIT_CARD: "Tarjeta",
    DIGITAL_WALLET: "Billetera",
    SAVINGS: "Ahorro",
    OTHER: "Otro",
  };

  const isCredit = account.type === "CREDIT_CARD";

  return (
    <div className="grid gap-3 bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Landmark className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold">{account.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge>{typeLabels[account.type]}</Badge>
            <span className="text-xs text-muted-foreground">{account.currency}</span>
            {account.creditLimit && (
              <span className="text-xs text-muted-foreground">
                Límite: {formatMoney(account.creditLimit, account.currency)}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className={`text-sm font-bold ${isCredit ? "text-rose-400" : "text-emerald-400"}`}>
            {formatMoney(account.currentBalance, account.currency)}
          </p>
          <p className="text-xs text-muted-foreground">saldo actual</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Editar
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onArchive}>
            {account.isArchived ? (
              <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Archive className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  tone: "default" | "positive" | "warning" | "danger";
  highlight?: boolean;
}) {
  const toneClass = {
    default: "text-sky-400",
    positive: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-rose-400",
  }[tone];

  return (
    <div className={`rounded-xl border border-border p-4 ${highlight ? "border-primary/30 bg-primary/5" : "bg-card"}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-xl font-bold tabular-nums ${highlight ? "text-foreground" : toneClass}`}>
        {value}
      </p>
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

function formatMoney(value: number, currency: CurrencyCode) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
