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
import { SensitiveAmount } from "@/components/app/sensitive-amount";
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
import { onMoneyKeyDown } from "@/lib/input-utils";
import { moneySchema, optionalMoneySchema } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  openingBalance: moneySchema({ allowNegative: true, allowZero: true }),
  creditLimit: optionalMoneySchema(),
});

const defaultForm: FormState = {
  name: "Cuenta bancaria",
  type: "BANK",
  currency: "ARS",
  openingBalance: "0",
  creditLimit: "",
};

export function AccountsClient({ householdId }: AccountsClientProps) {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [netWorthByCurrency, setNetWorthByCurrency] = useState<Array<{ currency: string; assets: number; liabilities: number; netWorth: number }>>([]);
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
        data?: {
          accounts: AccountItem[];
          assets: number;
          liabilities: number;
          debtLiabilities: number;
          netWorth: number;
          netWorthByCurrency: Array<{ currency: string; assets: number; liabilities: number; netWorth: number }>;
        };
        error?: string;
      };

      if (!response.ok) {
        toast.error(payload.error ?? "No se pudieron cargar las cuentas.");
        return;
      }

      if (payload.data) {
        setAccounts(payload.data.accounts);
        setNetWorthByCurrency(payload.data.netWorthByCurrency ?? []);
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

      const payload = (await response.json()) as { error?: string; fieldErrors?: FormErrors };

      if (!response.ok) {
        if (payload.fieldErrors) setErrors(payload.fieldErrors);
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
      creditLimit: account.creditLimit != null ? String(account.creditLimit) : "",
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
    <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <AppFormPanel
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        className="border-white/10 bg-zinc-950/80 shadow-[0_24px_80px_rgba(0,0,0,0.32)] xl:rounded-[var(--v2-radius-xl)]"
      >
        <div className={appFormHeaderClass("border-white/10 bg-zinc-950/95 xl:bg-transparent")}>
          <div className="flex items-start gap-3 p-5 sm:p-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight text-white">{editingAccountId ? "Editar lugar" : "Nuevo lugar"}</h2>
              <p className="mt-1 text-sm leading-5 text-zinc-400">
                {editingAccountId ? "Modificá los datos de la cuenta." : "Agregá una cuenta bancaria, efectivo o tarjeta."}
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
              <Input
                className={inputClass}
                maxLength={80}
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="Ej: Cuenta Galicia, Efectivo, Visa"
              />
            </Field>

            <Field label="Tipo" error={errors.type}>
              <select
                className={selectClass}
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
                  className={selectClass}
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
                  className={inputClass}
                  inputMode="decimal"
                  onKeyDown={onMoneyKeyDown}
                  value={form.openingBalance}
                  onChange={(e) => updateForm("openingBalance", e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>

            {form.type === "CREDIT_CARD" && (
              <Field label="Límite de crédito" error={errors.creditLimit}>
                <Input
                  className={inputClass}
                  inputMode="decimal"
                  onKeyDown={onMoneyKeyDown}
                  value={form.creditLimit}
                  onChange={(e) => updateForm("creditLimit", e.target.value)}
                  placeholder="Opcional"
                />
              </Field>
            )}

            {message ? (
              <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">{message}</p>
            ) : null}

            <div className={appFormActionsClass()}>
              <ActionButton className="w-full" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {editingAccountId ? "Guardar cambios" : "Crear lugar"}
              </ActionButton>
              {editingAccountId ? (
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
        {netWorthByCurrency.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Activos ARS" value={formatMoney(0, "ARS")} tone="positive" description="Sin cuentas activas" />
            <SummaryCard label="Pasivos ARS" value={formatMoney(0, "ARS")} tone="danger" description="Sin deudas activas" />
            <SummaryCard label="Patrimonio ARS" value={formatMoney(0, "ARS")} tone="default" description="Sin cuentas activas" highlight />
          </div>
        ) : (
          <div className="space-y-3">
            {netWorthByCurrency.map((item) => (
              <div key={item.currency} className="grid gap-3 sm:grid-cols-3">
                <SummaryCard
                  label={`Activos ${item.currency}`}
                  value={formatMoney(item.assets, item.currency)}
                  tone="positive"
                  description={`Balances positivos en ${item.currency}`}
                />
                <SummaryCard
                  label={`Pasivos ${item.currency}`}
                  value={formatMoney(item.liabilities, item.currency)}
                  tone="danger"
                  description={`Deudas y saldos negativos en ${item.currency}`}
                />
                <SummaryCard
                  label={`Patrimonio ${item.currency}`}
                  value={formatMoney(item.netWorth, item.currency)}
                  tone={item.netWorth >= 0 ? "default" : "warning"}
                  description={`Activos menos deuda en ${item.currency}`}
                  highlight
                />
              </div>
            ))}
            {netWorthByCurrency.length > 1 && (
              <p className="text-[11px] text-zinc-600">
                Los valores se muestran separados por moneda para evitar conversiones incorrectas.
              </p>
            )}
          </div>
        )}

        <PremiumCard>
          <PremiumCardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <PremiumCardTitle>Lugares activos</PremiumCardTitle>
                <PremiumCardDescription>{activeAccounts.length} cuentas donde vive tu dinero</PremiumCardDescription>
              </div>
              <div className="flex gap-2">
                <ActionButton
                  type="button"
                  variant="glass"
                  size="sm"
                  onClick={() => setShowArchived((v) => !v)}
                >
                  {showArchived ? "Ocultar archivadas" : "Ver archivadas"}
                </ActionButton>
                <ActionButton
                  type="button"
                  size="sm"
                  className="hidden xl:inline-flex"
                  onClick={() => { resetForm(); setIsFormOpen(true); }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Nueva
                </ActionButton>
              </div>
            </div>
          </PremiumCardHeader>
          <PremiumCardContent>
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
                title="Todavía no hay cuentas."
                description="Agregá una cuenta para que el sistema empiece a leer tus finanzas."
              />
            ) : (
              <div className="grid gap-3">
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
                <div className="grid gap-3 opacity-60">
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
          </PremiumCardContent>
        </PremiumCard>
      </div>

      <MobileCreateFab label="Nueva cuenta" onClick={() => { resetForm(); setIsFormOpen(true); }} />
    </div>
  );
}

const inputClass = "v2-focus-ring h-11 rounded-2xl border-white/10 bg-white/[0.05] text-white placeholder:text-zinc-600";
const selectClass = "v2-focus-ring h-11 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-base md:text-sm text-white outline-none transition hover:bg-white/[0.07]";

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
    <div className="grid gap-3 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.035] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-sky-100">
          <Landmark className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{account.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge className="border-white/10 bg-white/[0.06] text-zinc-200">{typeLabels[account.type]}</Badge>
            <span className="text-xs text-zinc-500">{account.currency}</span>
            {account.creditLimit && (
              <span className="text-xs text-muted-foreground">
                Límite: <SensitiveAmount value={formatMoney(account.creditLimit, account.currency)} />
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className={`text-sm font-bold ${account.currentBalance < 0 ? "text-rose-400" : "text-emerald-400"}`}>
            <SensitiveAmount value={formatMoney(account.currentBalance, account.currency)} />
          </p>
          <p className="text-xs text-muted-foreground">saldo actual</p>
        </div>
        <div className="flex gap-2">
          <ActionButton type="button" variant="glass" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Editar
          </ActionButton>
          <ActionButton type="button" variant="quiet" size="sm" onClick={onArchive}>
            {account.isArchived ? (
              <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Archive className="h-4 w-4" aria-hidden="true" />
            )}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  description,
  highlight,
}: {
  label: string;
  value: string;
  tone: "default" | "positive" | "warning" | "danger";
  description: string;
  highlight?: boolean;
}) {
  const toneClass = {
    default: "text-sky-400",
    positive: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-rose-400",
  }[tone];

  return (
    <div className={`rounded-3xl border border-white/[0.08] p-4 ${highlight ? "bg-white/[0.055]" : "bg-white/[0.035]"}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-2 text-xl font-bold tabular-nums ${highlight ? "text-foreground" : toneClass}`}>
        <SensitiveAmount value={value} />
      </p>
      <p className="mt-1 text-[11px] leading-4 text-zinc-500">{description}</p>
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
      <Label className="text-xs font-semibold uppercase text-zinc-500">{label}</Label>
      {children}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

function formatMoney(value: number, currency: CurrencyCode | string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
