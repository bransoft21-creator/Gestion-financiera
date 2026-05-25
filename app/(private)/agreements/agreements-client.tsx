"use client";

import { useMemo, useState } from "react";
import {
  useAgreements,
  useCloseAgreement,
  useCreateAgreement,
  useCreateAgreementEvent,
  type AgreementItem,
  type AgreementDirection,
} from "@/hooks/use-agreements";
import { useContacts, useCreateContact, type ContactItem } from "@/hooks/use-contacts";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  CircleDollarSign,
  HandCoins,
  Heart,
  Plus,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import {
  PremiumCard,
} from "@/components/ui-v2/premium-card";
import {
  AppFormPanel,
  appFormActionsClass,
  appFormContentClass,
  appFormHeaderClass,
} from "@/components/app/mobile-form";
import { SensitiveAmount } from "@/components/app/sensitive-amount";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney, formatRelativeDate } from "@/lib/format";
import { onMoneyKeyDown } from "@/lib/input-utils";
import { parseMoneyInput } from "@/lib/money";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CurrencyCode = "ARS" | "USD";
type AccountOption = { id: string; name: string; type: string; currency: CurrencyCode };

type Props = {
  householdId: string;
  accounts: AccountOption[];
  defaultCurrency: CurrencyCode;
};

// ---------------------------------------------------------------------------
// Direction config
// ---------------------------------------------------------------------------

const DIRECTION_LABELS: Record<AgreementDirection, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  LENT:     { label: "Les presté",   icon: ArrowUpRight,  color: "text-emerald-600" },
  BORROWED: { label: "Me prestaron", icon: ArrowDownLeft, color: "text-amber-600" },
  SHARED:   { label: "Compartimos",  icon: RefreshCw,     color: "text-blue-600" },
};

type AgreementTab = "active" | "attention" | "closed";

const ACTIVE_STATUSES = ["OPEN", "PARTIAL", "OVERDUE"] as const;
const CLOSED_STATUSES = ["CLOSED", "FORGIVEN", "CANCELED"] as const;

function isActiveAgreement(agreement: AgreementItem) {
  return ACTIVE_STATUSES.some((status) => status === agreement.status);
}

function isClosedAgreement(agreement: AgreementItem) {
  return CLOSED_STATUSES.some((status) => status === agreement.status);
}

function daysUntil(date: string | null) {
  if (!date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function getDueLabel(agreement: AgreementItem) {
  const diff = daysUntil(agreement.agreedReturnDate);

  if (agreement.status === "OVERDUE") {
    return agreement.agreedReturnDate ? `Venció ${formatDate(agreement.agreedReturnDate)}` : "Vencido";
  }

  if (diff === null) return formatRelativeDate(agreement.occurredAt);
  if (diff < 0) return `Venció ${formatDate(agreement.agreedReturnDate!)}`;
  if (diff === 0) return "Vence hoy";
  if (diff === 1) return "Vence mañana";
  if (diff <= 7) return `Vence en ${diff} días`;
  return `Para ${formatDate(agreement.agreedReturnDate!)}`;
}

function needsAttention(agreement: AgreementItem) {
  const diff = daysUntil(agreement.agreedReturnDate);
  return agreement.status === "OVERDUE" || (isActiveAgreement(agreement) && diff !== null && diff <= 7);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
}

function addMonths(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return formatDateInput(date);
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: AgreementItem["status"] }) {
  const map: Record<AgreementItem["status"], { label: string; className: string }> = {
    OPEN:     { label: "Pendiente",  className: "bg-muted text-muted-foreground" },
    PARTIAL:  { label: "Parcial",    className: "bg-primary/10 text-primary" },
    OVERDUE:  { label: "Vencido",    className: "bg-destructive/10 text-destructive" },
    CLOSED:   { label: "Resuelto",   className: "bg-emerald-500/10 text-emerald-700" },
    FORGIVEN: { label: "Condonado",  className: "bg-pink-500/10 text-pink-700" },
    CANCELED: { label: "Cancelado",  className: "bg-muted text-muted-foreground opacity-60" },
  };
  const { label, className } = map[status];
  return <Badge className={cn("text-[10px] px-1.5 py-0", className)}>{label}</Badge>;
}

// ---------------------------------------------------------------------------
// Contact avatar
// ---------------------------------------------------------------------------

function ContactAvatar({ name, color, size = "md" }: { name: string; color?: string | null; size?: "sm" | "md" }) {
  const initial = name.charAt(0).toUpperCase();
  const bg = color ?? "#6366f1";
  const sizeClass = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  return (
    <div
      className={cn("flex items-center justify-center rounded-full font-semibold text-white shrink-0", sizeClass)}
      style={{ backgroundColor: bg }}
    >
      {initial}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ percent, status }: { percent: number; status: AgreementItem["status"] }) {
  const color = status === "OVERDUE" ? "bg-destructive" : percent === 100 ? "bg-emerald-500" : "bg-primary";
  return (
    <div className="h-1 w-full rounded-full bg-muted overflow-hidden mt-1.5">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.max(percent, 2)}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agreement row — compact ledger layout
// ---------------------------------------------------------------------------

function AgreementLedgerRow({ agreement, onClick }: { agreement: AgreementItem; onClick: () => void }) {
  const dir = DIRECTION_LABELS[agreement.direction];
  const DirIcon = dir.icon;
  const isActive = isActiveAgreement(agreement);
  const isAttention = needsAttention(agreement);

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onClick={onClick}
      className={cn(
        "group w-full text-left transition-colors active:bg-muted/40",
        !isActive && "opacity-60",
      )}
    >
      <div className="flex min-h-[62px] items-center gap-3 px-3 py-2.5 sm:px-4">
        <ContactAvatar name={agreement.contact.name} color={agreement.contact.avatarColor} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold leading-tight">{agreement.contact.name}</p>
              <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-none text-muted-foreground">
                <DirIcon className={cn("h-3.5 w-3.5 shrink-0", dir.color)} />
                <span className={cn("shrink-0 font-medium", dir.color)}>{dir.label}</span>
                <span className="text-muted-foreground/50">·</span>
                <span className={cn("truncate", isAttention && "font-medium text-amber-400")}>
                  {getDueLabel(agreement)}
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <SensitiveAmount
                value={formatMoney(agreement.currentBalance, agreement.currency)}
                className="text-[14px] font-semibold tabular-nums leading-tight"
              />
              <div className="mt-1 flex justify-end">
                <StatusBadge status={agreement.status} />
              </div>
            </div>
          </div>
          {agreement.paidPercent > 0 && agreement.paidPercent < 100 && (
            <ProgressBar percent={agreement.paidPercent} status={agreement.status} />
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70 transition group-hover:text-foreground" />
      </div>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Agreements overview
// ---------------------------------------------------------------------------

function AgreementLedgerList({
  agreements,
  onSelect,
}: {
  agreements: AgreementItem[];
  onSelect: (agreement: AgreementItem) => void;
}) {
  return (
    <AnimatePresence mode="popLayout">
      <div className="overflow-hidden rounded-2xl border border-border bg-card/55 shadow-[var(--elevation-1)]">
        <div className="divide-y divide-border/70">
          {agreements.map((agreement) => (
            <AgreementLedgerRow
              key={agreement.id}
              agreement={agreement}
              onClick={() => onSelect(agreement)}
            />
          ))}
        </div>
      </div>
    </AnimatePresence>
  );
}

function AgreementsHero({
  summary,
  activeCount,
  attentionCount,
  currency,
  onCreate,
}: {
  summary?: { totalToReceive: number; totalToPay: number; netPosition: number; activeCount: number; overdueCount: number };
  activeCount: number;
  attentionCount: number;
  currency: string;
  onCreate: () => void;
}) {
  const totalToReceive = summary?.totalToReceive ?? 0;
  const totalToPay = summary?.totalToPay ?? 0;
  const netPosition = summary?.netPosition ?? 0;
  const isPositive = netPosition >= 0;
  const headline =
    activeCount === 0
      ? "Sin dinero interpersonal en movimiento."
      : attentionCount > 0
        ? `${attentionCount} pendiente${attentionCount === 1 ? "" : "s"} pide${attentionCount === 1 ? "" : "n"} atención.`
        : `${activeCount} acuerdo${activeCount === 1 ? "" : "s"} en tránsito.`;

  return (
    <PremiumCard variant="raised" className="mb-4 overflow-hidden p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <HandCoins className="h-3.5 w-3.5 text-primary" />
            Dinero humano en tránsito
          </div>
          <h2 className="text-balance text-xl font-semibold leading-tight text-foreground sm:text-2xl">
            {headline}
          </h2>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onCreate}
          className="h-9 shrink-0 rounded-full border border-teal-500/25 bg-teal-500/[0.08] px-3 text-teal-300 shadow-none hover:bg-teal-500/[0.14]"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">Por cobrar</p>
          <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-emerald-400">
            <SensitiveAmount value={formatMoney(totalToReceive, currency)} />
          </p>
        </div>
        <div className="min-w-0 text-center">
          <p className="text-[11px] text-muted-foreground">Neto</p>
          <p className={cn("mt-0.5 truncate text-xl font-semibold tabular-nums", isPositive ? "text-emerald-400" : "text-rose-400")}>
            <SensitiveAmount value={`${isPositive ? "+" : ""}${formatMoney(netPosition, currency)}`} />
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[11px] text-muted-foreground">Por pagar</p>
          <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-amber-400">
            <SensitiveAmount value={formatMoney(totalToPay, currency)} />
          </p>
        </div>
      </div>

      {(activeCount > 0 || attentionCount > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-border bg-muted/35 px-2.5 py-1 text-[11px] text-muted-foreground">
            {activeCount} activo{activeCount === 1 ? "" : "s"}
          </span>
          {attentionCount > 0 && (
            <span className="rounded-full border border-amber-400/15 bg-amber-400/[0.08] px-2.5 py-1 text-[11px] font-medium text-amber-400">
              {attentionCount} requiere{attentionCount === 1 ? "" : "n"} revisión
            </span>
          )}
        </div>
      )}
    </PremiumCard>
  );
}

function AgreementTabs({
  activeTab,
  onChange,
  activeCount,
  attentionCount,
  closedCount,
}: {
  activeTab: AgreementTab;
  onChange: (tab: AgreementTab) => void;
  activeCount: number;
  attentionCount: number;
  closedCount: number;
}) {
  const tabs: Array<{ id: AgreementTab; label: string; count: number }> = [
    { id: "active", label: "En curso", count: activeCount },
    { id: "attention", label: "Atención", count: attentionCount },
    { id: "closed", label: "Resueltos", count: closedCount },
  ];

  return (
    <div className="mb-3 flex items-center gap-1 overflow-x-auto rounded-full border border-border bg-muted/30 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors",
            activeTab === tab.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span>{tab.label}</span>
          {tab.count > 0 && (
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
              activeTab === tab.id ? "bg-muted text-foreground" : "bg-background/60 text-muted-foreground",
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function AgreementsEmptyState({
  activeTab,
  onCreate,
}: {
  activeTab: AgreementTab;
  onCreate: () => void;
}) {
  const copy = {
    active: {
      title: "Nada circulando ahora.",
      body: "Cuando prestes, debas o compartas dinero con alguien, Meridian lo va a seguir como parte de tu posición real.",
      action: "Registrar pendiente",
    },
    attention: {
      title: "Nada urgente.",
      body: "Los vencimientos cercanos y acuerdos atrasados van a aparecer acá sin mezclar ruido con el resto.",
      action: "Nuevo pendiente",
    },
    closed: {
      title: "Sin historial resuelto.",
      body: "Los acuerdos cerrados quedan como memoria financiera, no como tareas vivas.",
      action: "Registrar pendiente",
    },
  }[activeTab];

  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60">
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{copy.title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.body}</p>
          {activeTab !== "closed" && (
            <button
              type="button"
              onClick={onCreate}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition hover:text-primary/80"
            >
              <Plus className="h-3.5 w-3.5" />
              {copy.action}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event timeline item
// ---------------------------------------------------------------------------

const EVENT_LABELS: Record<string, string> = {
  PAYMENT_RECEIVED: "Abono recibido",
  PAYMENT_SENT:     "Pago realizado",
  INTEREST_APPLIED: "Interés aplicado",
  DATE_EXTENDED:    "Fecha extendida",
  REFINANCED:       "Refinanciado",
  PARTIAL_FORGIVEN: "Monto condonado",
  NOTE_ADDED:       "Acuerdo registrado",
  CLOSED:           "Cerrado",
  CANCELED:         "Cancelado",
};

const EVENT_COLORS: Record<string, string> = {
  PAYMENT_RECEIVED: "bg-emerald-500",
  PAYMENT_SENT:     "bg-amber-500",
  INTEREST_APPLIED: "bg-orange-500",
  PARTIAL_FORGIVEN: "bg-pink-500",
  CLOSED:           "bg-emerald-500",
  CANCELED:         "bg-muted-foreground",
  NOTE_ADDED:       "bg-primary/50",
  DATE_EXTENDED:    "bg-blue-400",
  REFINANCED:       "bg-blue-600",
};

function EventItem({ event }: { event: AgreementItem["events"][0] }) {
  const dotColor = EVENT_COLORS[event.type] ?? "bg-primary/50";
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0", dotColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{EVENT_LABELS[event.type] ?? event.type}</p>
        {event.amount && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatMoney(event.amount, event.currency ?? "ARS")}
          </p>
        )}
        {event.description && (
          <p className="text-xs text-muted-foreground">{event.description}</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground shrink-0 mt-0.5">{formatRelativeDate(event.occurredAt)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account selector (native, styled)
// ---------------------------------------------------------------------------

function AccountSelect({
  id,
  value,
  onChange,
  accounts,
  placeholder = "Sin vincular a cuenta",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  accounts: AccountOption[];
  placeholder?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-11 w-full rounded-2xl border border-input bg-background/35 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <option value="">{placeholder}</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function AgreementDetailPanel({
  agreement,
  accounts,
  householdId,
  onClose,
}: {
  agreement: AgreementItem;
  accounts: AccountOption[];
  householdId: string;
  onClose: () => void;
}) {
  const createEvent = useCreateAgreementEvent();
  const closeAgreement = useCloseAgreement();

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showCloseOptions, setShowCloseOptions] = useState(false);

  const dir = DIRECTION_LABELS[agreement.direction];
  const DirIcon = dir.icon;
  const isActive = ["OPEN", "PARTIAL", "OVERDUE"].includes(agreement.status);
  const paymentType = agreement.direction === "BORROWED" ? "PAYMENT_SENT" : "PAYMENT_RECEIVED";

  async function handlePayment() {
    const amount = parseMoneyInput(paymentAmount);
    if (!amount.success || !amount.data) return;

    await createEvent.mutateAsync({
      agreementId: agreement.id,
      householdId,
      type: paymentType,
      amount: amount.data,
      currency: agreement.currency,
      description: paymentNote || null,
      accountId: paymentAccountId || null,
      occurredAt: new Date().toISOString(),
    });

    setPaymentAmount("");
    setPaymentNote("");
    setPaymentAccountId("");
    setShowPaymentForm(false);
  }

  async function handleClose(closeType: "CLOSED" | "FORGIVEN" | "CANCELED") {
    await closeAgreement.mutateAsync({ agreementId: agreement.id, closeType });
    onClose();
  }

  return (
    <div className={appFormContentClass(true)}>
      <div className={appFormHeaderClass()}>
        <div className="flex items-center gap-3">
          <ContactAvatar name={agreement.contact.name} color={agreement.contact.avatarColor} size="md" />
          <div>
            <h2 className="font-semibold text-base leading-tight">{agreement.contact.name}</h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <DirIcon className={cn("h-3 w-3", dir.color)} />
              <span>{dir.label}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Hero balance */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-xs text-muted-foreground">Pendiente</p>
            <p className="text-2xl font-bold tracking-tight">
              <SensitiveAmount value={formatMoney(agreement.currentBalance, agreement.currency)} />
            </p>
            {agreement.paidPercent > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatMoney(agreement.originalAmount - agreement.currentBalance, agreement.currency)} abonados
                de {formatMoney(agreement.originalAmount, agreement.currency)}
              </p>
            )}
          </div>
          <StatusBadge status={agreement.status} />
        </div>

        {agreement.paidPercent > 0 && (
          <ProgressBar percent={agreement.paidPercent} status={agreement.status} />
        )}

        {agreement.description && (
          <p className="text-sm text-muted-foreground mt-2 italic">&ldquo;{agreement.description}&rdquo;</p>
        )}

        {agreement.agreedReturnDate && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {agreement.status === "OVERDUE"
                ? `Venció el ${formatDate(agreement.agreedReturnDate)}`
                : `Acordado para ${formatDate(agreement.agreedReturnDate)}`}
            </span>
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="px-4 py-3 flex-1 overflow-y-auto">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Historial</p>
        {agreement.events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Sin movimientos todavía.</p>
        ) : (
          <div className="divide-y divide-border">
            {[...agreement.events].reverse().map((ev) => (
              <EventItem key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </div>

      {/* Acciones */}
      {isActive && (
        <div className={appFormActionsClass()}>
          {!showPaymentForm && !showCloseOptions && (
            <div className="flex gap-2">
              <Button variant="default" className="flex-1" onClick={() => setShowPaymentForm(true)}>
                <HandCoins className="h-4 w-4 mr-2" />
                Registrar abono
              </Button>
              <Button variant="outline" onClick={() => setShowCloseOptions(true)}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          )}

          {showPaymentForm && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Registrar abono</p>
              <div>
                <Label htmlFor="paymentAmount">Monto</Label>
                <Input
                  id="paymentAmount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  onKeyDown={onMoneyKeyDown}
                />
              </div>
              <div>
                <Label htmlFor="paymentNote">Nota (opcional)</Label>
                <Input
                  id="paymentNote"
                  placeholder="Ej: me mandó por Mercado Pago"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                />
              </div>
              {accounts.length > 0 && (
                <div>
                  <Label htmlFor="paymentAccount">¿A qué cuenta entró? (opcional)</Label>
                  <AccountSelect
                    id="paymentAccount"
                    value={paymentAccountId}
                    onChange={setPaymentAccountId}
                    accounts={accounts}
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowPaymentForm(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  disabled={!paymentAmount || createEvent.isPending}
                  onClick={handlePayment}
                >
                  {createEvent.isPending ? "Guardando..." : "Confirmar"}
                </Button>
              </div>
            </div>
          )}

          {showCloseOptions && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">¿Cómo se resuelve?</p>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => handleClose("CLOSED")}
                disabled={closeAgreement.isPending}
              >
                <Check className="h-4 w-4 text-emerald-500" />
                Devolvieron todo — cerrado
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => handleClose("FORGIVEN")}
                disabled={closeAgreement.isPending}
              >
                <Heart className="h-4 w-4 text-pink-500" />
                Lo condoné — sin necesidad de devolución
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => handleClose("CANCELED")}
                disabled={closeAgreement.isPending}
              >
                <Ban className="h-4 w-4 text-muted-foreground" />
                Cancelar acuerdo — era un error
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setShowCloseOptions(false)}>
                Volver
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create agreement form — financial intent flow
// ---------------------------------------------------------------------------

type Step = "relation" | "amount" | "context";

const CREATE_STEPS: Array<{ id: Step; label: string }> = [
  { id: "relation", label: "Relación" },
  { id: "amount", label: "Monto" },
  { id: "context", label: "Contexto" },
];

const FLOW_DIRECTIONS: Record<AgreementDirection, {
  label: string;
  phrase: string;
  detail: string;
  activeClass: string;
  iconClass: string;
}> = {
  LENT: {
    label: "Presté",
    phrase: "salió de mí",
    detail: "Alguien te lo devuelve después.",
    activeClass: "border-emerald-400/35 bg-emerald-400/[0.09] text-emerald-300",
    iconClass: "text-emerald-400",
  },
  BORROWED: {
    label: "Me prestaron",
    phrase: "entra ahora",
    detail: "Es dinero que todavía no es completamente tuyo.",
    activeClass: "border-amber-400/35 bg-amber-400/[0.09] text-amber-300",
    iconClass: "text-amber-400",
  },
  SHARED: {
    label: "Compartimos",
    phrase: "está repartido",
    detail: "Un gasto o saldo dividido con otra persona.",
    activeClass: "border-sky-400/35 bg-sky-400/[0.09] text-sky-300",
    iconClass: "text-sky-400",
  },
};

function getStepTitle(step: Step) {
  if (step === "relation") return "Qué dinero está en tránsito";
  if (step === "amount") return "Cuánto queda flotando";
  return "Qué contexto necesita Meridian";
}

function getStepSignal(step: Step, direction: AgreementDirection, personName: string, amountPreview: string) {
  if (step === "relation") return "Definí la relación humana antes del número.";
  if (step === "amount") return personName ? `${FLOW_DIRECTIONS[direction].label} · ${personName}` : FLOW_DIRECTIONS[direction].detail;
  return `${amountPreview} · ${personName || "persona"}`;
}

function CreateAgreementForm({
  householdId,
  accounts,
  defaultCurrency,
  contacts,
  onClose,
  onContactCreated,
}: {
  householdId: string;
  accounts: AccountOption[];
  defaultCurrency: CurrencyCode;
  contacts: ContactItem[];
  onClose: () => void;
  onContactCreated: (c: ContactItem) => void;
}) {
  const createAgreement = useCreateAgreement();
  const createContact = useCreateContact();

  const [step, setStep] = useState<Step>("relation");
  const [direction, setDirection] = useState<AgreementDirection>("LENT");
  const [contactId, setContactId] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [showNewContact, setShowNewContact] = useState(contacts.length === 0);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const [agreedReturnDate, setAgreedReturnDate] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");

  const selectedContact = contacts.find((contact) => contact.id === contactId);
  const parsedAmount = parseMoneyInput(amount);
  const parsedAmountValue = parsedAmount.success ? parsedAmount.data : undefined;
  const hasRelation = Boolean(contactId || (showNewContact && newContactName.trim()));
  const hasAmount = Boolean(parsedAmountValue);
  const isSaving = createAgreement.isPending || createContact.isPending;
  const currentStepIndex = CREATE_STEPS.findIndex((item) => item.id === step);

  const personLabel = direction === "LENT"
    ? "A quién le prestaste"
    : direction === "BORROWED"
      ? "Quién te prestó"
      : "Con quién compartieron";

  const selectedPersonName = selectedContact?.name || newContactName.trim();
  const amountPreview = hasAmount ? formatMoney(parsedAmountValue!, currency) : "monto";
  const primaryLabel =
    step === "relation"
      ? selectedPersonName ? `Continuar con ${selectedPersonName}` : "Elegir persona"
      : step === "amount"
        ? hasAmount ? `Contexto para ${amountPreview}` : "Ingresar monto"
        : isSaving
          ? "Guardando..."
          : "Guardar pendiente";

  function goBack() {
    if (step === "context") {
      setStep("amount");
      return;
    }
    if (step === "amount") {
      setStep("relation");
    }
  }

  function handlePrimary() {
    if (step === "relation") {
      if (hasRelation) setStep("amount");
      return;
    }

    if (step === "amount") {
      if (hasAmount) setStep("context");
      return;
    }

    void handleSubmit();
  }

  async function handleSubmit() {
    if (!hasAmount) return;

    let finalContactId = contactId;

    if (showNewContact && newContactName.trim()) {
      const newContact = await createContact.mutateAsync({
        householdId,
        name: newContactName.trim(),
      });
      finalContactId = newContact.id;
      onContactCreated(newContact);
    }

    if (!finalContactId) return;

    await createAgreement.mutateAsync({
      householdId,
      contactId: finalContactId,
      direction,
      currency,
      originalAmount: parsedAmountValue!,
      description: description.trim() || null,
      agreedReturnDate: agreedReturnDate ? new Date(agreedReturnDate).toISOString() : null,
      occurredAt: new Date().toISOString(),
      sourceAccountId: sourceAccountId || null,
      notes: null,
    });

    onClose();
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[linear-gradient(180deg,hsl(var(--primary)/0.12),hsl(var(--card)/0.96)_64%,transparent)]" />

      <div className={appFormHeaderClass("relative flex items-center justify-between border-b-0 bg-transparent px-4 pb-2 pt-3 backdrop-blur-none")}>
        <button
          type="button"
          onClick={step === "relation" ? onClose : goBack}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/45 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          aria-label={step === "relation" ? "Cerrar" : "Volver"}
        >
          {step === "relation" ? <X className="h-4 w-4" /> : <ChevronDown className="h-5 w-5 rotate-90" />}
        </button>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Nuevo acuerdo</p>
          <p className="text-xs font-medium text-foreground/80">Pendientes</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/45 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground",
            step === "relation" && "opacity-0 pointer-events-none",
          )}
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative px-4 pb-3">
        <div className="rounded-[22px] border border-border/70 bg-background/35 px-4 py-3 shadow-[var(--elevation-1)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/[0.08]">
              <HandCoins className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-balance text-lg font-semibold leading-tight">{getStepTitle(step)}</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {getStepSignal(step, direction, selectedPersonName, amountPreview)}
              </p>
            </div>
          </div>

          <div className="mt-3">
            <div className="h-1 overflow-hidden rounded-full bg-muted/70">
              <div
                className="h-full rounded-full bg-foreground transition-all duration-300"
                style={{ width: `${((currentStepIndex + 1) / CREATE_STEPS.length) * 100}%` }}
              />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {CREATE_STEPS.map((item, index) => (
                <span
                  key={item.id}
                  className={cn(
                    "truncate text-[10px] font-semibold uppercase tracking-[0.08em]",
                    index <= currentStepIndex ? "text-foreground" : "text-muted-foreground/55",
                  )}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="app-form-content-scroll relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 pb-24 pt-1">
        {step === "relation" && (
          <div className="space-y-4">
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Movimiento</Label>
                <span className="text-[11px] text-muted-foreground">{FLOW_DIRECTIONS[direction].phrase}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-full border border-border bg-background/45 p-1">
                {(["LENT", "BORROWED", "SHARED"] as AgreementDirection[]).map((d) => {
                  const info = FLOW_DIRECTIONS[d];
                  const Icon = DIRECTION_LABELS[d].icon;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDirection(d)}
                      className={cn(
                        "flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full px-2 text-[11px] font-semibold transition-colors",
                        direction === d
                          ? info.activeClass
                          : "text-muted-foreground hover:bg-muted/45 hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", direction === d ? info.iconClass : "text-muted-foreground")} />
                      <span className="truncate">{info.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="px-1 text-xs leading-5 text-muted-foreground">{FLOW_DIRECTIONS[direction].detail}</p>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{personLabel}</Label>
                {contacts.length > 0 && showNewContact && (
                  <button
                    type="button"
                    onClick={() => { setShowNewContact(false); setNewContactName(""); }}
                    className="text-[11px] font-semibold text-primary"
                  >
                    Existente
                  </button>
                )}
              </div>

              {!showNewContact && contacts.length > 0 ? (
                <div className="space-y-2">
                  <div className="grid gap-1.5">
                    {contacts.slice(0, 6).map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => setContactId(contact.id)}
                        className={cn(
                          "flex min-h-10 items-center gap-3 rounded-2xl px-3 text-left transition-colors",
                          contactId === contact.id
                            ? "bg-foreground text-background"
                            : "bg-muted/25 text-foreground hover:bg-muted/45",
                        )}
                      >
                        <ContactAvatar name={contact.name} color={contact.avatarColor} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{contact.name}</span>
                        {contactId === contact.id && <Check className="h-4 w-4 shrink-0" />}
                      </button>
                    ))}
                  </div>
                  {contacts.length > 6 && (
                    <select
                      value={contactId}
                      onChange={(event) => setContactId(event.target.value)}
                      className="flex h-10 w-full rounded-2xl border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">Ver más personas...</option>
                      {contacts.map((contact) => (
                        <option key={contact.id} value={contact.id}>{contact.name}{contact.alias ? ` (${contact.alias})` : ""}</option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => { setShowNewContact(true); setContactId(""); }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full px-1 text-xs font-semibold text-primary transition hover:text-primary/80"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nueva persona
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-background/35 p-2">
                  <Input
                    placeholder="Nombre"
                    value={newContactName}
                    onChange={(event) => setNewContactName(event.target.value)}
                    autoFocus
                    className="h-10 rounded-xl border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
                  />
                </div>
              )}
            </section>
          </div>
        )}

        {step === "amount" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold", FLOW_DIRECTIONS[direction].activeClass)}>
                {FLOW_DIRECTIONS[direction].label}
              </span>
              <span className="rounded-full border border-border bg-muted/25 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                {selectedPersonName}
              </span>
            </div>

            <section className="rounded-[24px] border border-border bg-background/35 p-3">
              <Label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <CircleDollarSign className="h-4 w-4 text-primary" />
                Monto
              </Label>
              <div className="flex items-stretch gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  onKeyDown={onMoneyKeyDown}
                  className="h-16 flex-1 rounded-2xl border-0 bg-muted/30 text-3xl font-semibold tabular-nums shadow-none focus-visible:ring-1"
                  autoFocus
                />
                <div className="grid w-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted/20">
                  {(["ARS", "USD"] as CurrencyCode[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCurrency(c)}
                      className={cn(
                        "text-[11px] font-semibold transition-colors",
                        currency === c
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Este monto entra en tu posición interpersonal, separado de gastos y deuda formal.
              </p>
            </section>
          </div>
        )}

        {step === "context" && (
          <div className="space-y-3">
            <div className="rounded-[22px] border border-border bg-background/35 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Resumen</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{selectedPersonName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{FLOW_DIRECTIONS[direction].label}</p>
                </div>
                <SensitiveAmount value={amountPreview} className="shrink-0 text-lg font-semibold tabular-nums" />
              </div>
            </div>

            <section className="space-y-2">
              <Label htmlFor="agreementDesc" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Motivo</Label>
              <Input
                id="agreementDesc"
                placeholder="Viaje, alquiler, cena compartida..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="h-11 rounded-2xl bg-background/35"
              />
            </section>

            <section className="space-y-2">
              <Label htmlFor="agreementDate" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                Resolución
              </Label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: "Hoy", value: addDays(0) },
                  { label: "7 días", value: addDays(7) },
                  { label: "30 días", value: addDays(30) },
                  { label: "1 mes", value: addMonths(1) },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setAgreedReturnDate(option.value)}
                    className={cn(
                      "h-9 rounded-full border px-2 text-[11px] font-semibold transition-colors",
                      agreedReturnDate === option.value
                        ? "border-primary/40 bg-primary/[0.08] text-primary"
                        : "border-border bg-muted/20 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <Input
                id="agreementDate"
                type="date"
                value={agreedReturnDate}
                onChange={(event) => setAgreedReturnDate(event.target.value)}
                className="h-11 rounded-2xl bg-background/35"
              />
            </section>

            {accounts.length > 0 && (
              <section className="space-y-2">
                <Label htmlFor="sourceAccount" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cuenta vinculada</Label>
                <AccountSelect
                  id="sourceAccount"
                  value={sourceAccountId}
                  onChange={setSourceAccountId}
                  accounts={accounts}
                />
                {sourceAccountId && (
                  <p className="text-xs text-muted-foreground">
                    Meridian va a reflejar el movimiento en esa cuenta.
                  </p>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      <div className="relative shrink-0 border-t border-border bg-card/95 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
          <span>{CREATE_STEPS[currentStepIndex]?.label}</span>
          <span>{currentStepIndex + 1}/{CREATE_STEPS.length}</span>
        </div>
        <div className="flex gap-2">
          {step !== "relation" && (
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full" onClick={goBack} aria-label="Atrás">
              <ChevronDown className="h-5 w-5 rotate-90" />
            </Button>
          )}
          <Button
            type="button"
            className="h-11 flex-1 rounded-full"
            disabled={(step === "relation" && !hasRelation) || (step === "amount" && !hasAmount) || isSaving}
            onClick={handlePrimary}
          >
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client
// ---------------------------------------------------------------------------

export function AgreementsClient({ householdId, accounts, defaultCurrency }: Props) {
  const [activeTab, setActiveTab] = useState<AgreementTab>("active");
  const [selectedAgreementId, setSelectedAgreementId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data, isLoading } = useAgreements(householdId);
  const { data: contacts = [] } = useContacts(householdId);
  const [localContacts, setLocalContacts] = useState<ContactItem[]>([]);

  const allContacts = useMemo(() => {
    const ids = new Set(contacts.map((c) => c.id));
    return [...contacts, ...localContacts.filter((c) => !ids.has(c.id))];
  }, [contacts, localContacts]);

  const agreements = data?.agreements ?? [];
  const summary = data?.summary;
  const selectedAgreement = selectedAgreementId
    ? agreements.find((agreement) => agreement.id === selectedAgreementId) ?? null
    : null;

  const activeAgreements = agreements.filter(isActiveAgreement);
  const attentionAgreements = activeAgreements.filter(needsAttention);
  const closedAgreements = agreements.filter(isClosedAgreement);

  const displayed =
    activeTab === "active"
      ? activeAgreements
      : activeTab === "attention"
        ? attentionAgreements
        : closedAgreements;

  return (
    <div>
      <AgreementsHero
        summary={summary}
        activeCount={activeAgreements.length}
        attentionCount={attentionAgreements.length}
        currency={defaultCurrency}
        onCreate={() => setShowCreateForm(true)}
      />

      <AgreementTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        activeCount={activeAgreements.length}
        attentionCount={attentionAgreements.length}
        closedCount={closedAgreements.length}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[62px] w-full rounded-2xl" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <AgreementsEmptyState activeTab={activeTab} onCreate={() => setShowCreateForm(true)} />
      ) : (
        <AgreementLedgerList
          agreements={displayed}
          onSelect={(agreement) => setSelectedAgreementId(agreement.id)}
        />
      )}

      {/* Create form panel */}
      <AppFormPanel isOpen={showCreateForm} onClose={() => setShowCreateForm(false)}>
        {showCreateForm && (
          <CreateAgreementForm
            householdId={householdId}
            accounts={accounts}
            defaultCurrency={defaultCurrency}
            contacts={allContacts}
            onClose={() => setShowCreateForm(false)}
            onContactCreated={(c) => setLocalContacts((prev) => [c, ...prev])}
          />
        )}
      </AppFormPanel>

      {/* Detail panel */}
      <AppFormPanel isOpen={!!selectedAgreement} onClose={() => setSelectedAgreementId(null)}>
        {selectedAgreement && (
          <AgreementDetailPanel
            agreement={selectedAgreement}
            accounts={accounts}
            householdId={householdId}
            onClose={() => setSelectedAgreementId(null)}
          />
        )}
      </AppFormPanel>
    </div>
  );
}
