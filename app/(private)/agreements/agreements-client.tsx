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
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Plus,
  RefreshCw,
  Users,
  X,
  HandCoins,
  Ban,
  Heart,
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
import { onMoneyKeyDown } from "@/lib/input-utils";
import { parseMoneyInput } from "@/lib/money";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatMoney(value: number, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
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

function formatRelativeDate(value: string): string {
  const diff = Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "hoy";
  if (diff === 1) return "hace 1 día";
  if (diff < 30) return `hace ${diff} días`;
  if (diff < 60) return "hace 1 mes";
  return `hace ${Math.floor(diff / 30)} meses`;
}

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
// Direction labels
// ---------------------------------------------------------------------------

const DIRECTION_LABELS: Record<AgreementDirection, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  LENT:     { label: "Les presté", icon: ArrowUpRight,   color: "text-emerald-600" },
  BORROWED: { label: "Me prestaron", icon: ArrowDownLeft, color: "text-amber-600" },
  SHARED:   { label: "Compartimos",  icon: RefreshCw,     color: "text-blue-600" },
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: AgreementItem["status"] }) {
  const map: Record<AgreementItem["status"], { label: string; className: string }> = {
    OPEN:     { label: "Pendiente",  className: "bg-muted text-muted-foreground" },
    PARTIAL:  { label: "Con abonos", className: "bg-primary/10 text-primary" },
    OVERDUE:  { label: "Vencido",    className: "bg-destructive/10 text-destructive" },
    CLOSED:   { label: "Resuelto",   className: "bg-emerald-500/10 text-emerald-700" },
    FORGIVEN: { label: "Condonado",  className: "bg-pink-500/10 text-pink-700" },
    CANCELED: { label: "Cancelado",  className: "bg-muted text-muted-foreground opacity-60" },
  };
  const { label, className } = map[status];
  return <Badge className={className}>{label}</Badge>;
}

// ---------------------------------------------------------------------------
// Avatar inicial
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
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.max(percent, 2)}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agreement card
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
        <PremiumCardContent className="p-4">
          <div className="flex items-start gap-3">
            <ContactAvatar name={agreement.contact.name} color={agreement.contact.avatarColor} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold text-sm truncate">{agreement.contact.name}</span>
                <StatusBadge status={agreement.status} />
              </div>

              {agreement.description && (
                <p className="text-xs text-muted-foreground truncate mb-2">{agreement.description}</p>
              )}

              <div className="flex items-center gap-1.5 text-xs mb-2">
                <DirIcon className={cn("h-3.5 w-3.5", dir.color)} />
                <span className={cn("font-medium", dir.color)}>{dir.label}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{formatRelativeDate(agreement.occurredAt)}</span>
              </div>

              <div className="flex items-center justify-between text-sm mb-2">
                <SensitiveAmount value={formatMoney(agreement.currentBalance, agreement.currency)} />
                {agreement.paidPercent > 0 && agreement.paidPercent < 100 && (
                  <span className="text-xs text-muted-foreground">{agreement.paidPercent}% pagado</span>
                )}
              </div>

              {agreement.paidPercent > 0 && (
                <ProgressBar percent={agreement.paidPercent} status={agreement.status} />
              )}

              {agreement.agreedReturnDate && isActive && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {agreement.status === "OVERDUE"
                      ? `Venció el ${formatDate(agreement.agreedReturnDate)}`
                      : `Hasta el ${formatDate(agreement.agreedReturnDate)}`}
                  </span>
                </div>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          </div>
        </PremiumCardContent>
      </PremiumCard>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Summary banner
// ---------------------------------------------------------------------------

function SummaryBanner({
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

  return (
    <PremiumCard className="mb-4">
      <PremiumCardContent className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Por cobrar</p>
            <SensitiveAmount value={formatMoney(totalToReceive, currency)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Por pagar</p>
            <SensitiveAmount value={formatMoney(totalToPay, currency)} />
          </div>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">Posición neta</p>
          <SensitiveAmount
            value={`${netPosition >= 0 ? "+" : ""}${formatMoney(netPosition, currency)}`}
          />
        </div>
        {overdueCount > 0 && (
          <p className="text-xs text-destructive mt-2">
            {overdueCount} {overdueCount === 1 ? "acuerdo vencido" : "acuerdos vencidos"}
          </p>
        )}
      </PremiumCardContent>
    </PremiumCard>
  );
}

// ---------------------------------------------------------------------------
// Event timeline item
// ---------------------------------------------------------------------------

const EVENT_LABELS: Record<string, string> = {
  PAYMENT_RECEIVED: "Abono recibido",
  PAYMENT_SENT: "Pago realizado",
  INTEREST_APPLIED: "Interés aplicado",
  DATE_EXTENDED: "Fecha extendida",
  REFINANCED: "Refinanciado",
  PARTIAL_FORGIVEN: "Monto condonado",
  NOTE_ADDED: "Acuerdo registrado",
  CLOSED: "Cerrado",
  CANCELED: "Cancelado",
};

function EventItem({ event }: { event: AgreementItem["events"][0] }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="h-2 w-2 rounded-full bg-primary/50 mt-1.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{EVENT_LABELS[event.type] ?? event.type}</p>
        {event.amount && (
          <p className="text-xs text-muted-foreground">
            {formatMoney(event.amount, event.currency ?? "ARS")}
          </p>
        )}
        {event.description && (
          <p className="text-xs text-muted-foreground">{event.description}</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground shrink-0">{formatRelativeDate(event.occurredAt)}</p>
    </div>
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

      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-xs text-muted-foreground">Pendiente</p>
            <p className="text-2xl font-bold tracking-tight">
              <SensitiveAmount value={formatMoney(agreement.currentBalance, agreement.currency)} />
            </p>
          </div>
          <StatusBadge status={agreement.status} />
        </div>

        {agreement.paidPercent > 0 && (
          <>
            <ProgressBar percent={agreement.paidPercent} status={agreement.status} />
            <p className="text-xs text-muted-foreground mt-1">
              {formatMoney(agreement.originalAmount - agreement.currentBalance, agreement.currency)} abonados
              de {formatMoney(agreement.originalAmount, agreement.currency)} originales
            </p>
          </>
        )}

        {agreement.description && (
          <p className="text-sm text-muted-foreground mt-2 italic">"{agreement.description}"</p>
        )}

        {agreement.agreedReturnDate && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Acordado para {formatDate(agreement.agreedReturnDate)}</span>
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Historial</p>
        {agreement.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p>
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
              <Button
                variant="default"
                className="flex-1"
                onClick={() => setShowPaymentForm(true)}
              >
                <HandCoins className="h-4 w-4 mr-2" />
                Registrar abono
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCloseOptions(true)}
              >
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
                  <select
                    id="paymentAccount"
                    value={paymentAccountId}
                    onChange={(e) => setPaymentAccountId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Sin vincular a cuenta</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowPaymentForm(false)}
                >
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
              <p className="text-sm font-medium text-muted-foreground">Cerrar acuerdo</p>
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
                Cancelar — era un error
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowCloseOptions(false)}
              >
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
// Create agreement form
// ---------------------------------------------------------------------------

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

  const [direction, setDirection] = useState<AgreementDirection>("LENT");
  const [contactId, setContactId] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [showNewContact, setShowNewContact] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const [agreedReturnDate, setAgreedReturnDate] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [notes, setNotes] = useState("");

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
      agreedReturnDate: agreedReturnDate
        ? new Date(agreedReturnDate).toISOString()
        : null,
      occurredAt: new Date().toISOString(),
      sourceAccountId: sourceAccountId || null,
      notes: notes.trim() || null,
    });

    onClose();
  }

  const canSubmit =
    (contactId || (showNewContact && newContactName.trim())) &&
    amount &&
    !createAgreement.isPending;

  return (
    <div className={appFormContentClass(true)}>
      <div className={appFormHeaderClass()}>
        <h2 className="font-semibold text-base">Nuevo acuerdo</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Dirección */}
      <div className="px-4 py-3 border-b border-border">
        <Label className="mb-2 block">Tipo de acuerdo</Label>
        <div className="grid grid-cols-3 gap-2">
          {(["LENT", "BORROWED", "SHARED"] as AgreementDirection[]).map((d) => {
            const info = DIRECTION_LABELS[d];
            const Icon = info.icon;
            return (
              <button
                key={d}
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

      <div className="px-4 space-y-4 py-3">
        {/* Persona */}
        <div>
          <Label className="mb-1.5 block">
            {direction === "LENT" ? "¿A quién le prestaste?" : direction === "BORROWED" ? "¿Quién te prestó?" : "¿Con quién compartieron?"}
          </Label>
          {!showNewContact ? (
            <div className="space-y-2">
              {contacts.length > 0 && (
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
              )}
              <button
                onClick={() => { setShowNewContact(true); setContactId(""); }}
                className="text-xs text-primary hover:underline"
              >
                + Nueva persona
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
                  onClick={() => { setShowNewContact(false); setNewContactName(""); }}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  ← Elegir uno existente
                </button>
              )}
            </div>
          )}
        </div>

        {/* Monto y moneda */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <Label htmlFor="agreementAmount">Monto</Label>
            <Input
              id="agreementAmount"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={onMoneyKeyDown}
            />
          </div>
          <div>
            <Label htmlFor="agreementCurrency">Moneda</Label>
            <select
              id="agreementCurrency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        {/* Descripción */}
        <div>
          <Label htmlFor="agreementDesc">¿Para qué? (opcional)</Label>
          <Input
            id="agreementDesc"
            placeholder="Ej: Para el viaje, Para el alquiler..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Fecha acordada */}
        <div>
          <Label htmlFor="agreementDate">¿Cuándo acordaron devolver? (opcional)</Label>
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
            <Label htmlFor="sourceAccount">¿De qué cuenta salió el dinero? (opcional)</Label>
            <select
              id="sourceAccount"
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Sin vincular a cuenta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {sourceAccountId && (
              <p className="text-xs text-muted-foreground mt-1">
                El monto se registrará automáticamente en esa cuenta.
              </p>
            )}
          </div>
        )}
      </div>

      <div className={appFormActionsClass()}>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {createAgreement.isPending ? "Guardando..." : "Registrar"}
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
      {/* Summary */}
      {summary && summary.activeCount > 0 && (
        <SummaryBanner
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
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
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
      <AppFormPanel
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
      >
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
      <AppFormPanel
        isOpen={!!selectedAgreement}
        onClose={() => setSelectedAgreement(null)}
      >
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
