"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Check, CheckCircle2, Circle, Clock, Copy, Home, Loader2, Mail, MessageCircle, Plus, ReceiptText, Send, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useHideAmounts } from "@/hooks/use-hide-amounts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Household = {
  id: string;
  name: string;
  avatar: string | null;
  createdAt: string | Date;
  members: Array<{
    id: string;
    role: string;
    status: string;
    userProfileId: string;
    userProfile: {
      fullName: string | null;
      email: string;
      avatarUrl: string | null;
    };
  }>;
  invites: Array<{
    id: string;
    email: string;
    expiresAt: string | Date;
    status: string;
  }>;
};

type HouseholdBalance = {
  summary: string;
  lastSettledAt: string | null;
  settlement: {
    fromName: string;
    toName: string;
    amount: number;
  } | null;
  members: Array<{
    userId: string;
    name: string;
    email: string;
    balance: number;
  }>;
  recentSharedTransactions: Array<{
    id: string;
    description: string | null;
    amount: number;
    currency: "ARS" | "USD";
    occurredAt: string;
    paidByName: string;
    participantCount: number;
  }>;
};

type HouseholdSettlement = {
  id: string;
  amount: number;
  notes: string | null;
  createdAt: string;
  settledBy: {
    fullName: string | null;
    email: string;
  };
};

type HouseholdBriefingStatus = "STABLE" | "NEEDS_BALANCE" | "LOW_ACTIVITY" | "HIGH_SPEND";

type HouseholdBriefing = {
  status: HouseholdBriefingStatus;
  tone: "emerald" | "amber" | "blue" | "zinc";
  title: string;
  summary: string;
  metrics: {
    totalSharedAmount: number;
    transactionCount: number;
    pendingAmount: number;
    currency: "ARS" | "USD";
    topPayer: {
      userId: string;
      name: string;
      amount: number;
    } | null;
  };
  topCategories: Array<{
    id: string;
    name: string;
    color: string | null;
    amount: number;
    count: number;
  }>;
  settlement: HouseholdBalance["settlement"];
  memberBalances: HouseholdBalance["members"];
  ctas: Array<{
    label: string;
    href: string;
    intent: "primary" | "secondary";
  }>;
};

type RecurringPayment = {
  id: string;
  name: string;
  estimatedAmount: number;
  currency: "ARS" | "USD";
  dueDay: number;
  splitMode: "EQUAL" | "PERCENTAGE" | "CUSTOM_AMOUNT";
  category: { id: string; name: string; color: string | null } | null;
  participants: Array<{ userId: string; percentage: number | null; fixedAmount: number | null }>;
  status: "PENDING" | "PAID" | "OVERDUE";
  occurrence: {
    id: string;
    paidAt: string | null;
    paidByUserId: string | null;
    finalAmount: number | null;
    sharedTransactionId: string | null;
  } | null;
};

type RecurringPaymentsSummary = {
  payments: RecurringPayment[];
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  totalCount: number;
  summary: string;
};

type UserAccount = {
  id: string;
  householdId: string;
  householdName: string | undefined;
  name: string;
  type: string;
  currency: "ARS" | "USD";
  currentBalance: number;
};

export function HouseholdClient({ initialHouseholds }: { initialHouseholds: Household[] }) {
  const [households, setHouseholds] = useState(initialHouseholds);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(initialHouseholds[0]?.id ?? "");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("H");
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [hasCopiedInvite, setHasCopiedInvite] = useState(false);
  const [balance, setBalance] = useState<HouseholdBalance | null>(null);
  const [briefing, setBriefing] = useState<HouseholdBriefing | null>(null);
  const [settlements, setSettlements] = useState<HouseholdSettlement[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPaymentsSummary | null>(null);
  const [isLoadingRecurring, setIsLoadingRecurring] = useState(false);
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [payingOccurrenceId, setPayingOccurrenceId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState<{ paidByUserId: string; accountId: string; finalAmount: string }>({ paidByUserId: "", accountId: "", finalAmount: "" });
  const [isPaying, setIsPaying] = useState(false);
  const [isAddingRecurring, setIsAddingRecurring] = useState(false);
  const [newPaymentForm, setNewPaymentForm] = useState({ name: "", estimatedAmount: "", dueDay: "1", splitMode: "EQUAL" as const });
  const [isCreatingRecurring, setIsCreatingRecurring] = useState(false);

  const selectedHousehold = useMemo(
    () => households.find((household) => household.id === selectedHouseholdId) ?? households[0],
    [households, selectedHouseholdId],
  );
  const hideAmounts = useHideAmounts();

  async function reloadHouseholds(nextSelectedId?: string) {
    const response = await fetch("/api/households");
    const payload = (await response.json()) as { data?: Household[]; error?: string };

    if (!response.ok || !payload.data) {
      toast.error(payload.error ?? "No se pudo cargar el hogar.");
      return;
    }

    setHouseholds(payload.data);
    if (nextSelectedId) setSelectedHouseholdId(nextSelectedId);
  }

  async function createHousehold() {
    setIsCreating(true);
    try {
      const response = await fetch("/api/households", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatar }),
      });
      const payload = (await response.json()) as { data?: Household; error?: string };

      if (!response.ok || !payload.data) {
        toast.error(payload.error ?? "No se pudo crear el hogar.");
        return;
      }

      toast.success("Hogar creado.");
      setName("");
      setAvatar("H");
      await reloadHouseholds(payload.data.id);
    } finally {
      setIsCreating(false);
    }
  }

  async function inviteMember() {
    if (!selectedHousehold) return;

    setIsInviting(true);
    try {
      const response = await fetch("/api/households/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId: selectedHousehold.id, email }),
      });
      const payload = (await response.json()) as {
        data?: { inviteUrl: string };
        error?: string;
      };

      if (!response.ok || !payload.data) {
        toast.error(payload.error ?? "No se pudo crear la invitación.");
        return;
      }

      setInviteUrl(payload.data.inviteUrl);
      setHasCopiedInvite(false);
      setEmail("");
      toast.success("Invitación lista para enviar.");
      await reloadHouseholds(selectedHousehold.id);
    } finally {
      setIsInviting(false);
    }
  }

  async function loadBalance() {
    if (!selectedHousehold) return;

    setIsLoadingBalance(true);
    try {
      const params = new URLSearchParams({ householdId: selectedHousehold.id });
      const response = await fetch(`/api/households/balance?${params.toString()}`);
      const payload = (await response.json()) as { data?: HouseholdBalance; error?: string };

      if (!response.ok || !payload.data) {
        toast.error(payload.error ?? "No se pudo calcular el balance.");
        return;
      }

      setBalance(payload.data);
    } finally {
      setIsLoadingBalance(false);
    }
  }

  async function loadBriefing(householdId = selectedHousehold?.id) {
    if (!householdId) return;

    setIsLoadingBriefing(true);
    try {
      const params = new URLSearchParams({ householdId });
      const response = await fetch(`/api/households/briefing?${params.toString()}`);
      const payload = (await response.json()) as { data?: HouseholdBriefing; error?: string };

      if (!response.ok || !payload.data) {
        toast.error(payload.error ?? "No se pudo leer el estado del hogar.");
        return;
      }

      setBriefing(payload.data);
    } finally {
      setIsLoadingBriefing(false);
    }
  }

  async function loadSettlements(householdId = selectedHousehold?.id) {
    if (!householdId) return;

    const params = new URLSearchParams({ householdId });
    const response = await fetch(`/api/households/settlements?${params.toString()}`);
    const payload = (await response.json()) as { data?: HouseholdSettlement[]; error?: string };

    if (response.ok && payload.data) {
      setSettlements(payload.data);
    }
  }

  async function settleBalance() {
    if (!selectedHousehold || !balance?.settlement) return;

    setIsSettling(true);
    try {
      const response = await fetch("/api/households/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: selectedHousehold.id,
          amount: balance.settlement.amount,
        }),
      });
      const payload = (await response.json()) as { data?: HouseholdSettlement; error?: string };

      if (!response.ok || !payload.data) {
        toast.error(payload.error ?? "No se pudo registrar el equilibrio.");
        return;
      }

      toast.success("El hogar quedó equilibrado.");
      await Promise.all([loadBalance(), loadSettlements(selectedHousehold.id)]);
    } finally {
      setIsSettling(false);
    }
  }

  async function loadRecurringPayments(householdId = selectedHousehold?.id) {
    if (!householdId) return;
    setIsLoadingRecurring(true);
    try {
      const params = new URLSearchParams({ householdId });
      const response = await fetch(`/api/households/recurring-payments?${params}`);
      const payload = await response.json() as { data?: RecurringPaymentsSummary; error?: string };
      if (response.ok && payload.data) setRecurringPayments(payload.data);
    } finally {
      setIsLoadingRecurring(false);
    }
  }

  async function loadUserAccounts() {
    const response = await fetch("/api/accounts/mine");
    const payload = await response.json() as { data?: UserAccount[]; error?: string };
    if (response.ok && payload.data) setUserAccounts(payload.data);
  }

  async function openPayDialog(payment: RecurringPayment) {
    setPayingOccurrenceId(payment.id);
    setPayForm({
      paidByUserId: "",
      accountId: userAccounts[0]?.id ?? "",
      finalAmount: String(payment.estimatedAmount),
    });
    if (userAccounts.length === 0) await loadUserAccounts();
  }

  function closePayDialog() {
    setPayingOccurrenceId(null);
  }

  async function confirmMarkAsPaid(paymentId: string) {
    if (!selectedHousehold || isPaying) return;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const paidByUserId = payForm.paidByUserId || selectedHousehold.members[0]?.userProfileId;

    setIsPaying(true);
    try {
      const response = await fetch(`/api/households/recurring-payments/${paymentId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: selectedHousehold.id,
          monthKey,
          paidByUserId,
          accountId: payForm.accountId,
          finalAmount: payForm.finalAmount ? Number(payForm.finalAmount) : undefined,
        }),
      });
      const payload = await response.json() as { data?: unknown; error?: string };
      if (!response.ok) { toast.error(payload.error ?? "No se pudo marcar como pagado."); return; }
      toast.success("Pago registrado.");
      closePayDialog();
      await Promise.all([loadRecurringPayments(selectedHousehold.id), loadBriefing(selectedHousehold.id)]);
    } finally {
      setIsPaying(false);
    }
  }

  async function createRecurringPayment() {
    if (!selectedHousehold || isCreatingRecurring) return;
    setIsCreatingRecurring(true);
    try {
      const response = await fetch("/api/households/recurring-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: selectedHousehold.id,
          name: newPaymentForm.name,
          estimatedAmount: Number(newPaymentForm.estimatedAmount),
          dueDay: Number(newPaymentForm.dueDay),
          splitMode: newPaymentForm.splitMode,
        }),
      });
      const payload = await response.json() as { data?: unknown; error?: string };
      if (!response.ok) { toast.error(payload.error ?? "No se pudo crear el pago."); return; }
      toast.success("Pago fijo agregado.");
      setNewPaymentForm({ name: "", estimatedAmount: "", dueDay: "1", splitMode: "EQUAL" });
      setIsAddingRecurring(false);
      await loadRecurringPayments(selectedHousehold.id);
    } finally {
      setIsCreatingRecurring(false);
    }
  }

  useEffect(() => {
    if (!selectedHousehold) return;
    const timer = window.setTimeout(() => {
      void loadBriefing(selectedHousehold.id);
      void loadSettlements(selectedHousehold.id);
      void loadRecurringPayments(selectedHousehold.id);
      void loadUserAccounts();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHousehold?.id]);

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setHasCopiedInvite(true);
    toast.success("Link copiado.");
  }

  function shareByWhatsApp() {
    if (!inviteUrl || !selectedHousehold) return;

    const text = encodeURIComponent(
      `Te invité a ${selectedHousehold.name} en Meridian Household. Abrí este link para aceptar: ${inviteUrl}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <section className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Crear hogar</CardTitle>
            <CardDescription>Nombre, ícono opcional y listo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[72px_1fr] gap-3">
              <div className="space-y-2">
                <Label>Icono</Label>
                <Input value={avatar} maxLength={4} onChange={(event) => setAvatar(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nuestro hogar" />
              </div>
            </div>
            <Button className="w-full" disabled={isCreating || name.trim().length < 2} onClick={() => void createHousehold()}>
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear hogar
            </Button>
          </CardContent>
        </Card>

        {households.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Tus hogares</CardTitle>
              <CardDescription>Elegí un espacio para ver miembros y balance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {households.map((household) => (
                <button
                  key={household.id}
                  type="button"
                  onClick={() => {
                    setSelectedHouseholdId(household.id);
                    setBalance(null);
                    setBriefing(null);
                    setSettlements([]);
                    setInviteUrl("");
                    setHasCopiedInvite(false);
                    setRecurringPayments(null);
                    setPayingOccurrenceId(null);
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    selectedHousehold?.id === household.id
                      ? "border-teal-300/30 bg-teal-300/10"
                      : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                  }`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.07] text-lg">
                    {household.avatar || <Home className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{household.name}</span>
                    <span className="text-xs text-muted-foreground">{household.members.length} miembros</span>
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section className="space-y-5">
        {!selectedHousehold ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Creá tu primer hogar para invitar miembros y compartir gastos.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{selectedHousehold.name}</CardTitle>
                    <CardDescription>Un espacio compartido, separado de tu feed personal.</CardDescription>
                  </div>
                  <Badge className="border-teal-300/20 bg-teal-300/10 text-teal-100">Household</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedHousehold.members.map((member) => (
                    <div key={member.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {member.userProfile.fullName ?? member.userProfile.email}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{member.userProfile.email}</p>
                    </div>
                  ))}
                </div>

                <div id="invite-member" className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      <Label>Invitar por email</Label>
                      <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="persona@email.com" />
                    </div>
                    <Button className="self-end" disabled={isInviting || !email} onClick={() => void inviteMember()}>
                      {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Invitar
                    </Button>
                  </div>
                  {inviteUrl ? (
                    <div className="mt-3 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-sm font-semibold text-foreground">Copiá este link y envialo por WhatsApp</p>
                      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
                        <Mail className="h-4 w-4 shrink-0 text-teal-100" />
                        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{inviteUrl}</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button variant="secondary" onClick={() => void copyInvite()}>
                          {hasCopiedInvite ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {hasCopiedInvite ? "Copiado" : "Copiar link"}
                        </Button>
                        <Button type="button" variant="outline" onClick={shareByWhatsApp}>
                          <MessageCircle className="h-4 w-4" />
                          Compartir por WhatsApp
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {selectedHousehold.invites.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {selectedHousehold.invites.map((invite) => (
                        <div key={invite.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{invite.email}</span>
                          <Badge>Pendiente</Badge>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Lectura del hogar</CardTitle>
                    <CardDescription>Una mirada simple del mes compartido.</CardDescription>
                  </div>
                  <Badge className={getBriefingBadgeClass(briefing?.status)}>
                    {isLoadingBriefing ? "Leyendo" : briefing?.title ?? "Sin datos"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={`rounded-2xl border p-4 ${getBriefingPanelClass(briefing?.status)}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.08]">
                      {isLoadingBriefing ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <WalletCards className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {briefing ? getBriefingSummary(briefing, hideAmounts) : "Todavía no hay suficientes movimientos compartidos."}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        El briefing usa solo gastos compartidos del mes actual.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <BriefingMetric
                    label="Compartido este mes"
                    value={formatMoney(briefing?.metrics.totalSharedAmount ?? 0, briefing?.metrics.currency ?? "ARS", hideAmounts)}
                  />
                  <BriefingMetric
                    label="Gastos compartidos"
                    value={String(briefing?.metrics.transactionCount ?? 0)}
                  />
                  <BriefingMetric
                    label="Pagó más"
                    value={briefing?.metrics.topPayer?.name ?? "Sin datos"}
                  />
                  <BriefingMetric
                    label="Pendiente"
                    value={formatMoney(briefing?.metrics.pendingAmount ?? 0, briefing?.metrics.currency ?? "ARS", hideAmounts)}
                  />
                </div>

                {briefing?.topCategories.length ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                      <BarChart3 className="h-3.5 w-3.5" />
                      Categorías compartidas
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {briefing.topCategories.map((category) => (
                        <div key={category.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: category.color ?? "#5eead4" }}
                            />
                            <p className="truncate text-sm font-semibold text-foreground">{category.name}</p>
                          </div>
                          <p className="mt-2 text-sm font-bold text-foreground">
                            {formatMoney(category.amount, briefing.metrics.currency, hideAmounts)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {category.count} gasto{category.count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-sm font-semibold text-foreground">Sin categorías compartidas todavía.</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Cuando los gastos tengan categoría, Meridian va a destacar las más relevantes.
                    </p>
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-3">
                  {(briefing?.ctas ?? defaultBriefingCtas).map((cta) => (
                    <Button
                      key={cta.href}
                      asChild
                      variant={cta.intent === "primary" ? "default" : "outline"}
                      className="w-full"
                    >
                      <Link href={cta.href}>
                        {cta.label}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Pagos del hogar</CardTitle>
                    <CardDescription>Gastos fijos del mes compartido.</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingRecurring((prev) => !prev)}
                  >
                    <Plus className="h-4 w-4" />
                    {isAddingRecurring ? "Cancelar" : "Agregar"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isAddingRecurring ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nombre</Label>
                        <Input
                          value={newPaymentForm.name}
                          onChange={(e) => setNewPaymentForm(p => ({ ...p, name: e.target.value }))}
                          placeholder="Alquiler, Luz, Internet…"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Monto estimado</Label>
                        <Input
                          type="number"
                          value={newPaymentForm.estimatedAmount}
                          onChange={(e) => setNewPaymentForm(p => ({ ...p, estimatedAmount: e.target.value }))}
                          placeholder="50000"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Día de vencimiento</Label>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={newPaymentForm.dueDay}
                          onChange={(e) => setNewPaymentForm(p => ({ ...p, dueDay: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>División</Label>
                        <select
                          className="flex h-10 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-base md:text-sm text-foreground"
                          value={newPaymentForm.splitMode}
                          onChange={(e) => setNewPaymentForm(p => ({ ...p, splitMode: e.target.value as "EQUAL" }))}
                        >
                          <option value="EQUAL">Partes iguales</option>
                          <option value="PERCENTAGE">Porcentaje</option>
                          <option value="CUSTOM_AMOUNT">Monto fijo</option>
                        </select>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      disabled={isCreatingRecurring || !newPaymentForm.name.trim() || !newPaymentForm.estimatedAmount}
                      onClick={() => void createRecurringPayment()}
                    >
                      {isCreatingRecurring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Agregar pago fijo
                    </Button>
                  </div>
                ) : null}

                {recurringPayments && recurringPayments.totalCount > 0 ? (
                  <div className={`rounded-2xl border p-4 ${getRecurringPaymentsPanelClass(recurringPayments)}`}>
                    <p className="text-sm font-semibold text-foreground">{recurringPayments.summary}</p>
                  </div>
                ) : null}

                {isLoadingRecurring ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : recurringPayments?.payments.length ? (
                  <div className="space-y-2">
                    {recurringPayments.payments.map((payment) => (
                      <div key={payment.id}>
                        <div className={`flex items-center gap-3 rounded-2xl border p-3 transition ${getPaymentRowClass(payment.status)}`}>
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${getPaymentIconClass(payment.status)}`}>
                            {payment.status === "PAID" ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : payment.status === "OVERDUE" ? (
                              <Clock className="h-4 w-4" />
                            ) : (
                              <Circle className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{payment.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {payment.status === "PAID"
                                ? `Pagado${payment.occurrence?.paidAt ? ` · ${formatSettlementDate(payment.occurrence.paidAt)}` : ""}`
                                : `Vence día ${payment.dueDay}`}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-foreground">
                            {formatMoney(
                              payment.occurrence?.finalAmount ?? payment.estimatedAmount,
                              payment.currency,
                              hideAmounts,
                            )}
                          </p>
                          {payment.status !== "PAID" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="shrink-0 text-xs"
                              onClick={() => void openPayDialog(payment)}
                            >
                              Pagar
                            </Button>
                          ) : null}
                        </div>

                        {payingOccurrenceId === payment.id ? (
                          <div className="mt-1 rounded-2xl border border-teal-300/20 bg-teal-300/[0.07] p-4 space-y-3">
                            <p className="text-sm font-semibold text-foreground">Registrar pago — {payment.name}</p>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Pagó</Label>
                                <select
                                  className="flex h-10 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-base md:text-sm text-foreground"
                                  value={payForm.paidByUserId || selectedHousehold?.members[0]?.userProfileId}
                                  onChange={(e) => setPayForm(p => ({ ...p, paidByUserId: e.target.value }))}
                                >
                                  {selectedHousehold?.members.map((member) => (
                                    <option key={member.userProfileId} value={member.userProfileId}>
                                      {member.userProfile.fullName ?? member.userProfile.email}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-2">
                                <Label>Cuenta</Label>
                                <select
                                  className="flex h-10 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-base md:text-sm text-foreground"
                                  value={payForm.accountId}
                                  onChange={(e) => setPayForm(p => ({ ...p, accountId: e.target.value }))}
                                >
                                  <option value="">Elegir cuenta…</option>
                                  {userAccounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.name} — {account.householdName}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Monto final (opcional)</Label>
                              <Input
                                type="number"
                                value={payForm.finalAmount}
                                onChange={(e) => setPayForm(p => ({ ...p, finalAmount: e.target.value }))}
                                placeholder={String(payment.estimatedAmount)}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                className="flex-1"
                                disabled={isPaying || !payForm.accountId}
                                onClick={() => void confirmMarkAsPaid(payment.id)}
                              >
                                {isPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                Confirmar pago
                              </Button>
                              <Button variant="ghost" onClick={closePayDialog}>
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : !isLoadingRecurring ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm font-semibold text-foreground">Sin pagos fijos registrados.</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Agregá el alquiler, la luz o Internet para no perderlos de vista.
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Balance del hogar</CardTitle>
                    <CardDescription>Resumen humano de gastos 50/50.</CardDescription>
                  </div>
                  <Button variant="secondary" onClick={() => void loadBalance()} disabled={isLoadingBalance}>
                    {isLoadingBalance ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}
                    Actualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-teal-300/15 bg-teal-300/10 p-4">
                  <p className="text-sm font-semibold text-teal-50">{getBalanceSummary(balance, hideAmounts)}</p>
                  <p className="mt-1 text-xs leading-5 text-teal-100/70">
                    {balance?.lastSettledAt
                      ? `Desde el último equilibrio: ${formatSettlementDate(balance.lastSettledAt)}.`
                      : "Marcá un gasto como compartido desde Movimientos para empezar."}
                  </p>
                </div>

                {balance ? (
                  <>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {balance.members.map((member) => (
                        <div key={member.userId} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                          <p className="truncate text-sm font-semibold text-foreground">{member.name}</p>
                          <p className={`mt-2 text-lg font-bold ${member.balance >= 0 ? "text-emerald-200" : "text-amber-200"}`}>
                            {formatMoney(Math.abs(member.balance), "ARS", hideAmounts)}
                          </p>
                          <p className="text-xs text-muted-foreground">{member.balance >= 0 ? "cubrió de más" : "por compensar"}</p>
                        </div>
                      ))}
                    </div>

                    {balance.settlement ? (
                      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                        <p className="text-sm font-semibold text-amber-100">
                          {hideAmounts
                            ? `${balance.settlement.fromName} tiene un saldo pendiente.`
                            : `${balance.settlement.fromName} le debe ${formatMoney(balance.settlement.amount, "ARS")} a ${balance.settlement.toName}.`}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-amber-100/70">
                          Cuando lo resuelvan entre ustedes, marcá el hogar como equilibrado.
                        </p>
                        <Button
                          className="mt-3 w-full border-amber-300/20 bg-amber-300/15 text-amber-50 hover:bg-amber-300/25"
                          variant="outline"
                          disabled={isSettling}
                          onClick={() => void settleBalance()}
                        >
                          {isSettling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Marcar como equilibrado
                        </Button>
                      </div>
                    ) : null}

                    {balance.recentSharedTransactions.length > 0 ? (
                      <div className="space-y-2">
                        {balance.recentSharedTransactions.slice(0, 5).map((transaction) => (
                          <div key={transaction.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{transaction.description ?? "Gasto compartido"}</p>
                              <p className="truncate text-xs text-muted-foreground">Pagó {transaction.paidByName}</p>
                            </div>
                            <p className="shrink-0 text-sm font-bold text-foreground">{formatMoney(transaction.amount, transaction.currency, hideAmounts)}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/transactions?new=1">
                      <Plus className="h-4 w-4" />
                      Agregar gasto compartido
                    </Link>
                  </Button>
                )}

                {settlements.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Equilibrios registrados
                    </div>
                    {settlements.map((settlement) => (
                      <div key={settlement.id} className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/10 bg-emerald-300/5 p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-emerald-100">El hogar quedó equilibrado</p>
                          <p className="truncate text-xs text-muted-foreground">
                            Marcado por {settlement.settledBy.fullName ?? settlement.settledBy.email} · {formatSettlementDate(settlement.createdAt)}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-emerald-200">{formatMoney(Number(settlement.amount), "ARS", hideAmounts)}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </div>
  );
}

function formatMoney(value: number, currency: "ARS" | "USD", hidden = false) {
  if (hidden) return "$••••";

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "ARS" ? 0 : 2,
  }).format(value);
}

function getBalanceSummary(balance: HouseholdBalance | null, hidden: boolean) {
  if (!balance) return "Todavía no hay gastos compartidos.";
  if (!hidden) return balance.summary;
  if (!balance.settlement) return "El hogar viene estable.";

  return `${balance.settlement.fromName} tiene un balance pendiente con ${balance.settlement.toName}.`;
}

function BriefingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs leading-5 text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

const defaultBriefingCtas = [
  { label: "Agregar gasto compartido", href: "/transactions?new=1", intent: "primary" },
  { label: "Invitar miembro", href: "#invite-member", intent: "secondary" },
  { label: "Ver movimientos", href: "/transactions", intent: "secondary" },
] as const;

function getBriefingSummary(briefing: HouseholdBriefing, hidden: boolean) {
  if (!hidden) return briefing.summary;
  if (briefing.status === "STABLE") return "El hogar viene estable este mes.";
  if (briefing.status === "LOW_ACTIVITY") return "Todavía no hay suficientes movimientos compartidos.";
  if (briefing.status === "HIGH_SPEND") return "El gasto compartido viene más alto que lo habitual.";
  if (!briefing.settlement) return "Hay un saldo pendiente por equilibrar.";

  return `${briefing.settlement.fromName} tiene un saldo pendiente con ${briefing.settlement.toName}.`;
}

function getBriefingBadgeClass(status: HouseholdBriefingStatus | undefined) {
  if (status === "STABLE") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (status === "NEEDS_BALANCE") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  if (status === "HIGH_SPEND") return "border-sky-300/20 bg-sky-300/10 text-sky-100";

  return "border-white/10 bg-white/[0.06] text-zinc-200";
}

function getBriefingPanelClass(status: HouseholdBriefingStatus | undefined) {
  if (status === "STABLE") return "border-emerald-300/15 bg-emerald-300/10";
  if (status === "NEEDS_BALANCE") return "border-amber-300/15 bg-amber-300/10";
  if (status === "HIGH_SPEND") return "border-sky-300/15 bg-sky-300/10";

  return "border-white/10 bg-white/[0.04]";
}

function formatSettlementDate(dateStr: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(dateStr));
}

function getRecurringPaymentsPanelClass(rp: RecurringPaymentsSummary) {
  if (rp.overdueCount > 0) return "border-amber-300/20 bg-amber-300/10";
  if (rp.paidCount === rp.totalCount) return "border-emerald-300/20 bg-emerald-300/10";
  return "border-white/10 bg-white/[0.04]";
}

function getPaymentRowClass(status: "PENDING" | "PAID" | "OVERDUE") {
  if (status === "PAID") return "border-emerald-300/15 bg-emerald-300/[0.06] opacity-75";
  if (status === "OVERDUE") return "border-amber-300/20 bg-amber-300/[0.07]";
  return "border-white/10 bg-white/[0.04]";
}

function getPaymentIconClass(status: "PENDING" | "PAID" | "OVERDUE") {
  if (status === "PAID") return "bg-emerald-300/15 text-emerald-200";
  if (status === "OVERDUE") return "bg-amber-300/15 text-amber-200";
  return "bg-white/[0.07] text-zinc-400";
}
