"use client";

import { useEffect, useMemo, useState } from "react";
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
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  HandCoins,
  Heart,
  Plus,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import {
  PremiumCard,
  PremiumCardContent,
} from "@/components/ui-v2/premium-card";
import {
  AppFormPanel,
  MobileCreateFab,
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
// Agreement card — compact 2-row layout
// ---------------------------------------------------------------------------

function AgreementCard({ agreement, onClick }: { agreement: AgreementItem; onClick: () => void }) {
  const dir = DIRECTION_LABELS[agreement.direction];
  const DirIcon = dir.icon;
  const isActive = ["OPEN", "PARTIAL", "OVERDUE"].includes(agreement.status);

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onClick={onClick}
      className="w-full text-left"
    >
      <PremiumCard className={cn("transition-colors hover:border-primary/40", !isActive && "opacity-60")}>
        <PremiumCardContent className="px-4 py-3">
          <div className="flex items-center gap-3">
            <ContactAvatar name={agreement.contact.name} color={agreement.contact.avatarColor} size="sm" />
            <div className="flex-1 min-w-0">
              {/* Row 1: name + amount */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm truncate leading-tight">{agreement.contact.name}</span>
                <SensitiveAmount value={formatMoney(agreement.currentBalance, agreement.currency)} className="text-sm font-semibold shrink-0" />
              </div>
              {/* Row 2: direction + date + status */}
              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                <DirIcon className={cn("h-3 w-3 shrink-0", dir.color)} />
                <span className={cn("font-medium", dir.color)}>{dir.label}</span>
                <span className="mx-0.5">·</span>
                <span className="truncate">{formatRelativeDate(agreement.occurredAt)}</span>
                {agreement.status === "OVERDUE" && agreement.agreedReturnDate && (
                  <>
                    <span className="mx-0.5">·</span>
                    <Clock className="h-3 w-3 shrink-0 text-destructive" />
                    <span className="text-destructive shrink-0">venció {formatDate(agreement.agreedReturnDate)}</span>
                  </>
                )}
                <div className="ml-auto shrink-0">
                  <StatusBadge status={agreement.status} />
                </div>
              </div>
              {/* Progress (only when partially paid) */}
              {agreement.paidPercent > 0 && agreement.paidPercent < 100 && (
                <ProgressBar percent={agreement.paidPercent} status={agreement.status} />
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </PremiumCardContent>
      </PremiumCard>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Summary strip — compact horizontal MetricStrip
// ---------------------------------------------------------------------------

function SummaryStrip({
  totalToReceive,
  totalToPay,
  netPosition,
  overdueCount,
  currency,
}: {
  totalToReceive: number;
  totalToPay: number;
  netPosition: number;
  overdueCount: number;
  currency: string;
}) {
  if (totalToReceive === 0 && totalToPay === 0) return null;

  const netColor = netPosition >= 0 ? "text-emerald-600" : "text-destructive";

  return (
    <div className="mb-4 rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center">
        <div className="flex-1 text-center py-2.5 px-3">
          <p className="text-[10px] text-muted-foreground mb-0.5">Por cobrar</p>
          <p className="text-sm font-semibold text-emerald-600 leading-tight">
            <SensitiveAmount value={formatMoney(totalToReceive, currency)} />
          </p>
        </div>
        <div className="w-px h-10 bg-border shrink-0" />
        <div className="flex-1 text-center py-2.5 px-3">
          <p className="text-[10px] text-muted-foreground mb-0.5">Posición neta</p>
          <p className={cn("text-sm font-bold leading-tight", netColor)}>
            <SensitiveAmount value={`${netPosition >= 0 ? "+" : ""}${formatMoney(netPosition, currency)}`} />
          </p>
        </div>
        <div className="w-px h-10 bg-border shrink-0" />
        <div className="flex-1 text-center py-2.5 px-3">
          <p className="text-[10px] text-muted-foreground mb-0.5">Por pagar</p>
          <p className="text-sm font-semibold text-amber-600 leading-tight">
            <SensitiveAmount value={formatMoney(totalToPay, currency)} />
          </p>
        </div>
      </div>
      {overdueCount > 0 && (
        <div className="border-t border-border py-1.5 text-center text-xs text-destructive">
          {overdueCount} acuerdo{overdueCount > 1 ? "s" : ""} vencido{overdueCount > 1 ? "s" : ""}
        </div>
      )}
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
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
// Create agreement form — 2-step flow
// ---------------------------------------------------------------------------

type Step = 1 | 2;

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

  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState<AgreementDirection>("LENT");
  const [contactId, setContactId] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [showNewContact, setShowNewContact] = useState(contacts.length === 0);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const [agreedReturnDate, setAgreedReturnDate] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");

  const step1Valid = contactId || (showNewContact && newContactName.trim());
  const step2Valid = !!amount && !createAgreement.isPending;

  async function handleSubmit() {
    const parsed = parseMoneyInput(amount);
    if (!parsed.success || !parsed.data) return;

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
      originalAmount: parsed.data,
      description: description.trim() || null,
      agreedReturnDate: agreedReturnDate ? new Date(agreedReturnDate).toISOString() : null,
      occurredAt: new Date().toISOString(),
      sourceAccountId: sourceAccountId || null,
      notes: null,
    });

    onClose();
  }

  const personLabel = direction === "LENT"
    ? "¿A quién le prestaste?"
    : direction === "BORROWED"
    ? "¿Quién te prestó?"
    : "¿Con quién compartieron?";

  return (
    <div className={appFormContentClass(true)}>
      <div className={appFormHeaderClass()}>
        <div className="flex items-center gap-2">
          {step === 2 && (
            <button onClick={() => setStep(1)} className="text-muted-foreground hover:text-foreground mr-1">
              <ChevronDown className="h-5 w-5 rotate-90" />
            </button>
          )}
          <h2 className="font-semibold text-base">
            {step === 1 ? "Nuevo acuerdo" : "Monto y detalles"}
          </h2>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1 px-4 pt-2 pb-0">
        <div className={cn("h-0.5 flex-1 rounded-full transition-colors", step >= 1 ? "bg-primary" : "bg-muted")} />
        <div className={cn("h-0.5 flex-1 rounded-full transition-colors", step >= 2 ? "bg-primary" : "bg-muted")} />
      </div>

      {step === 1 ? (
        <div className="px-4 space-y-5 py-4">
          {/* Dirección */}
          <div>
            <Label className="mb-2 block text-sm">Tipo de acuerdo</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["LENT", "BORROWED", "SHARED"] as AgreementDirection[]).map((d) => {
                const info = DIRECTION_LABELS[d];
                const Icon = info.icon;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDirection(d)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-colors",
                      direction === d
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", direction === d ? "text-primary" : info.color)} />
                    {info.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Persona */}
          <div>
            <Label className="mb-1.5 block text-sm">{personLabel}</Label>
            {!showNewContact ? (
              <div className="space-y-2">
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Elegir persona...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.alias ? ` (${c.alias})` : ""}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => { setShowNewContact(true); setContactId(""); }}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" />
                  Nueva persona
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Nombre (ej: Juan, Mamá, El Ruso)"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  autoFocus
                />
                {contacts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setShowNewContact(false); setNewContactName(""); }}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    ← Elegir uno existente
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 space-y-4 py-4">
          {/* Monto + moneda */}
          <div>
            <Label className="mb-1.5 block text-sm">Monto</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={onMoneyKeyDown}
                className="flex-1"
                autoFocus
              />
              {/* Currency pill toggle */}
              <div className="flex rounded-md border border-input overflow-hidden shrink-0">
                {(["ARS", "USD"] as CurrencyCode[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={cn(
                      "px-3 h-9 text-sm font-medium transition-colors",
                      currency === c
                        ? "bg-primary text-primary-foreground"
                        : "bg-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <Label htmlFor="agreementDesc" className="mb-1.5 block text-sm">¿Para qué? (opcional)</Label>
            <Input
              id="agreementDesc"
              placeholder="Ej: Para el viaje, Para el alquiler..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Fecha */}
          <div>
            <Label htmlFor="agreementDate" className="mb-1.5 block text-sm">¿Cuándo acordaron devolver? (opcional)</Label>
            <Input
              id="agreementDate"
              type="date"
              value={agreedReturnDate}
              onChange={(e) => setAgreedReturnDate(e.target.value)}
            />
          </div>

          {/* Cuenta origen */}
          {accounts.length > 0 && (
            <div>
              <Label htmlFor="sourceAccount" className="mb-1.5 block text-sm">¿De qué cuenta? (opcional)</Label>
              <AccountSelect
                id="sourceAccount"
                value={sourceAccountId}
                onChange={setSourceAccountId}
                accounts={accounts}
              />
              {sourceAccountId && (
                <p className="text-xs text-muted-foreground mt-1">
                  El monto se registrará automáticamente en esa cuenta.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className={appFormActionsClass()}>
        {step === 1 ? (
          <Button
            className="w-full"
            disabled={!step1Valid}
            onClick={() => setStep(2)}
          >
            Siguiente
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
              Atrás
            </Button>
            <Button
              className="flex-1"
              disabled={!step2Valid}
              onClick={handleSubmit}
            >
              {createAgreement.isPending ? "Guardando..." : "Registrar"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client
// ---------------------------------------------------------------------------

export function AgreementsClient({ householdId, accounts, defaultCurrency }: Props) {
  const [activeTab, setActiveTab] = useState<"active" | "closed">("active");
  const [selectedAgreement, setSelectedAgreement] = useState<AgreementItem | null>(null);
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

  // Sync selected agreement when data refreshes
  useEffect(() => {
    if (selectedAgreement) {
      const updated = agreements.find((a) => a.id === selectedAgreement.id);
      if (updated) setSelectedAgreement(updated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agreements]);

  const activeAgreements = agreements.filter((a) =>
    ["OPEN", "PARTIAL", "OVERDUE"].includes(a.status),
  );
  const closedAgreements = agreements.filter((a) =>
    ["CLOSED", "FORGIVEN", "CANCELED"].includes(a.status),
  );

  const displayed = activeTab === "active" ? activeAgreements : closedAgreements;

  return (
    <div className="relative">
      {/* Summary strip */}
      {summary && summary.activeCount > 0 && (
        <SummaryStrip
          totalToReceive={summary.totalToReceive}
          totalToPay={summary.totalToPay}
          netPosition={summary.netPosition}
          overdueCount={summary.overdueCount}
          currency={defaultCurrency}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-4">
        <button
          onClick={() => setActiveTab("active")}
          className={cn(
            "flex-1 text-sm py-1.5 rounded-md font-medium transition-colors",
            activeTab === "active"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Activos
          {activeAgreements.length > 0 && (
            <span className="ml-1.5 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              {activeAgreements.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("closed")}
          className={cn(
            "flex-1 text-sm py-1.5 rounded-md font-medium transition-colors",
            activeTab === "closed"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Cerrados
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-sm">
            {activeTab === "active" ? "Sin acuerdos activos" : "Sin acuerdos cerrados"}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            {activeTab === "active"
              ? "Registrá cuando le prestás a alguien o te prestan a vos."
              : "Los acuerdos que cierres o se resuelvan aparecerán acá."}
          </p>
          {activeTab === "active" && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
            >
              <Plus className="h-4 w-4" />
              Registrar primer acuerdo
            </button>
          )}
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-2">
            {displayed.map((a) => (
              <AgreementCard
                key={a.id}
                agreement={a}
                onClick={() => setSelectedAgreement(a)}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* FAB */}
      <MobileCreateFab label="Nuevo acuerdo" onClick={() => setShowCreateForm(true)} />

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
      <AppFormPanel isOpen={!!selectedAgreement} onClose={() => setSelectedAgreement(null)}>
        {selectedAgreement && (
          <AgreementDetailPanel
            agreement={selectedAgreement}
            accounts={accounts}
            householdId={householdId}
            onClose={() => setSelectedAgreement(null)}
          />
        )}
      </AppFormPanel>
    </div>
  );
}
