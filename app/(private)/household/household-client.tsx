"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, Circle, Clock, Copy, Home, Loader2, Mail, MessageCircle, Plus, Send, Users, WalletCards } from "lucide-react";
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
    topPayer: { userId: string; name: string; amount: number } | null;
  };
  topCategories: Array<{ id: string; name: string; color: string | null; amount: number; count: number }>;
  settlement: HouseholdBalance["settlement"];
  memberBalances: HouseholdBalance["members"];
  ctas: Array<{ label: string; href: string; intent: "primary" | "secondary" }>;
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

type HouseholdTab = "overview" | "payments" | "team";

export function HouseholdClient({ initialHouseholds }: { initialHouseholds: Household[] }) {
  const [households, setHouseholds] = useState(initialHouseholds);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(initialHouseholds[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<HouseholdTab>("overview");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🏠");
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [hasCopiedInvite, setHasCopiedInvite] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSettlementsHistory, setShowSettlementsHistory] = useState(false);
  const [showPaidPayments, setShowPaidPayments] = useState(false);
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
    () => households.find((h) => h.id === selectedHouseholdId) ?? households[0],
    [households, selectedHouseholdId],
  );

  const currentMonthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        month: "long",
        year: "numeric",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date()),
    [],
  );

  const hideAmounts = useHideAmounts();

  function switchHousehold(id: string) {
    setSelectedHouseholdId(id);
    setActiveTab("overview");
    setBalance(null);
    setBriefing(null);
    setSettlements([]);
    setInviteUrl("");
    setHasCopiedInvite(false);
    setRecurringPayments(null);
    setPayingOccurrenceId(null);
    setShowSettlementsHistory(false);
    setShowPaidPayments(false);
    setIsAddingRecurring(false);
  }

  async function reloadHouseholds(nextSelectedId?: string) {
    const response = await fetch("/api/households");
    const payload = (await response.json()) as { data?: Household[]; error?: string };
    if (!response.ok || !payload.data) { toast.error(payload.error ?? "No se pudo cargar el hogar."); return; }
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
      if (!response.ok || !payload.data) { toast.error(payload.error ?? "No se pudo crear el hogar."); return; }
      toast.success("Hogar creado.");
      setName("");
      setAvatar("🏠");
      setShowCreateForm(false);
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
      const payload = (await response.json()) as { data?: { inviteUrl: string }; error?: string };
      if (!response.ok || !payload.data) { toast.error(payload.error ?? "No se pudo crear la invitación."); return; }
      setInviteUrl(payload.data.inviteUrl);
      setHasCopiedInvite(false);
      setEmail("");
      toast.success("Invitación lista para enviar.");
      await reloadHouseholds(selectedHousehold.id);
    } finally {
      setIsInviting(false);
    }
  }

  async function loadBalance(householdId = selectedHousehold?.id) {
    if (!householdId) return;
    setIsLoadingBalance(true);
    try {
      const params = new URLSearchParams({ householdId });
      const response = await fetch(`/api/households/balance?${params.toString()}`);
      const payload = (await response.json()) as { data?: HouseholdBalance; error?: string };
      if (response.ok && payload.data) setBalance(payload.data);
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
      if (response.ok && payload.data) setBriefing(payload.data);
    } finally {
      setIsLoadingBriefing(false);
    }
  }

  async function loadSettlements(householdId = selectedHousehold?.id) {
    if (!householdId) return;
    const params = new URLSearchParams({ householdId });
    const response = await fetch(`/api/households/settlements?${params.toString()}`);
    const payload = (await response.json()) as { data?: HouseholdSettlement[]; error?: string };
    if (response.ok && payload.data) setSettlements(payload.data);
  }

  async function settleBalance() {
    if (!selectedHousehold || !balance?.settlement) return;
    setIsSettling(true);
    try {
      const response = await fetch("/api/households/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId: selectedHousehold.id, amount: balance.settlement.amount }),
      });
      const payload = (await response.json()) as { data?: HouseholdSettlement; error?: string };
      if (!response.ok || !payload.data) { toast.error(payload.error ?? "No se pudo registrar el equilibrio."); return; }
      toast.success("El hogar quedó equilibrado.");
      await Promise.all([loadBalance(selectedHousehold.id), loadSettlements(selectedHousehold.id)]);
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
      const payload = (await response.json()) as { data?: RecurringPaymentsSummary; error?: string };
      if (response.ok && payload.data) setRecurringPayments(payload.data);
    } finally {
      setIsLoadingRecurring(false);
    }
  }

  async function loadUserAccounts() {
    const response = await fetch("/api/accounts/mine");
    const payload = (await response.json()) as { data?: UserAccount[]; error?: string };
    if (response.ok && payload.data) setUserAccounts(payload.data);
  }

  async function openPayDialog(payment: RecurringPayment) {
    setPayingOccurrenceId(payment.id);
    setPayForm({ paidByUserId: "", accountId: userAccounts[0]?.id ?? "", finalAmount: String(payment.estimatedAmount) });
    if (userAccounts.length === 0) await loadUserAccounts();
  }

  function closePayDialog() { setPayingOccurrenceId(null); }

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
      const payload = (await response.json()) as { data?: unknown; error?: string };
      if (!response.ok) { toast.error(payload.error ?? "No se pudo marcar como pagado."); return; }
      toast.success("Pago registrado.");
      closePayDialog();
      await Promise.all([
        loadRecurringPayments(selectedHousehold.id),
        loadBalance(selectedHousehold.id),
        loadBriefing(selectedHousehold.id),
      ]);
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
      const payload = (await response.json()) as { data?: unknown; error?: string };
      if (!response.ok) { toast.error(payload.error ?? "No se pudo crear el pago."); return; }
      toast.success("Pago fijo agregado.");
      setNewPaymentForm({ name: "", estimatedAmount: "", dueDay: "1", splitMode: "EQUAL" });
      setIsAddingRecurring(false);
      await loadRecurringPayments(selectedHousehold.id);
    } finally {
      setIsCreatingRecurring(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setHasCopiedInvite(true);
    toast.success("Link copiado.");
  }

  function shareByWhatsApp() {
    if (!inviteUrl || !selectedHousehold) return;
    const text = encodeURIComponent(`Te invité a ${selectedHousehold.name} en Meridian. Abrí este link para aceptar: ${inviteUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    if (!selectedHousehold) return;
    const timer = window.setTimeout(() => {
      void loadBriefing(selectedHousehold.id);
      void loadBalance(selectedHousehold.id);
      void loadSettlements(selectedHousehold.id);
      void loadRecurringPayments(selectedHousehold.id);
      void loadUserAccounts();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHousehold?.id]);

  // ── EMPTY STATE (no households) ─────────────────────────────────────────
  if (households.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-white/[0.07] text-2xl">🏠</div>
          <h2 className="text-lg font-semibold text-foreground">Creá tu hogar compartido</h2>
          <p className="mt-1 text-sm text-muted-foreground">Invitá a tu pareja o familia para organizar gastos juntos.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
          <div className="grid grid-cols-[72px_1fr] gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Ícono</Label>
              <Input value={avatar} maxLength={4} onChange={(e) => setAvatar(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuestro hogar" />
            </div>
          </div>
          <Button className="w-full" disabled={isCreating || name.trim().length < 2} onClick={() => void createHousehold()}>
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Crear hogar
          </Button>
        </div>
      </div>
    );
  }

  // ── MAIN LAYOUT ─────────────────────────────────────────────────────────
  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">

      {/* ── SIDEBAR ── */}
      <section className="space-y-2">
        {households.map((household) => (
          <button
            key={household.id}
            type="button"
            onClick={() => switchHousehold(household.id)}
            className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
              selectedHousehold?.id === household.id
                ? "border-teal-300/30 bg-teal-300/10"
                : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-base">
              {household.avatar || <Home className="h-4 w-4" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{household.name}</span>
              <span className="text-xs text-muted-foreground">{household.members.length} personas</span>
            </span>
          </button>
        ))}

        {showCreateForm ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nuevo hogar</p>
            <div className="grid grid-cols-[60px_1fr] gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Ícono</Label>
                <Input value={avatar} maxLength={4} onChange={(e) => setAvatar(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuestro hogar" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" disabled={isCreating || name.trim().length < 2} onClick={() => void createHousehold()}>
                {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Crear
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreateForm(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-white/10 px-3 py-2.5 text-sm text-muted-foreground transition hover:border-white/20 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo hogar
          </button>
        )}
      </section>

      {/* ── MAIN CONTENT ── */}
      <section className="space-y-4 min-w-0">
        {!selectedHousehold ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
            <p className="text-sm text-muted-foreground">Seleccioná un hogar para continuar.</p>
          </div>
        ) : (
          <>
            {/* Household header */}
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.07] text-lg">
                {selectedHousehold.avatar || <Home className="h-5 w-5" />}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-foreground">{selectedHousehold.name}</h2>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {selectedHousehold.members.slice(0, 5).map((member) => (
                    <span
                      key={member.id}
                      title={member.userProfile.fullName ?? member.userProfile.email}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-300/20 text-[10px] font-bold text-teal-100"
                    >
                      {(member.userProfile.fullName ?? member.userProfile.email).charAt(0).toUpperCase()}
                    </span>
                  ))}
                  <span className="text-xs text-muted-foreground">
                    {selectedHousehold.members.length} {selectedHousehold.members.length === 1 ? "persona" : "personas"}
                  </span>
                </div>
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
              {(["overview", "payments", "team"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    activeTab === tab
                      ? "bg-white/10 text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "overview" && <WalletCards className="h-3.5 w-3.5" />}
                  {tab === "payments" && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {tab === "team" && <Users className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">
                    {tab === "overview" ? "Inicio" : tab === "payments" ? "Pagos" : "Equipo"}
                  </span>
                  <span className="sm:hidden">
                    {tab === "overview" ? "Inicio" : tab === "payments" ? "Pagos" : "Equipo"}
                  </span>
                </button>
              ))}
            </div>

            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* Briefing banner */}
                <div className={`rounded-2xl border p-4 ${getBriefingPanelClass(briefing?.status)}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08]">
                      {isLoadingBriefing
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <WalletCards className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {briefing
                          ? getBriefingSummary(briefing, hideAmounts)
                          : isLoadingBriefing
                          ? "Leyendo el mes…"
                          : "Todavía no hay movimientos compartidos este mes."}
                      </p>
                    </div>
                    {briefing ? (
                      <Badge className={`shrink-0 ${getBriefingBadgeClass(briefing.status)}`}>
                        {briefing.title}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {/* Balance card */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">Balance</CardTitle>
                        {balance?.lastSettledAt ? (
                          <CardDescription>Desde {formatDate(balance.lastSettledAt)}</CardDescription>
                        ) : null}
                      </div>
                      {/* Overdue payments alert chip */}
                      {recurringPayments && recurringPayments.overdueCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setActiveTab("payments")}
                          className="flex items-center gap-1.5 rounded-xl border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs font-medium text-amber-200 transition hover:bg-amber-300/20"
                        >
                          <Clock className="h-3 w-3" />
                          {recurringPayments.overdueCount} vencido{recurringPayments.overdueCount > 1 ? "s" : ""}
                        </button>
                      ) : recurringPayments && recurringPayments.pendingCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setActiveTab("payments")}
                          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                        >
                          <Circle className="h-3 w-3" />
                          {recurringPayments.pendingCount} pendiente{recurringPayments.pendingCount > 1 ? "s" : ""}
                        </button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Settlement action */}
                    {balance?.settlement ? (
                      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                        <p className="text-sm font-semibold text-amber-100">
                          {hideAmounts
                            ? `${balance.settlement.fromName} tiene un saldo pendiente.`
                            : `${balance.settlement.fromName} le debe ${formatMoney(balance.settlement.amount, "ARS")} a ${balance.settlement.toName}.`}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-amber-100/70">
                          Cuando lo resuelvan, marcá el hogar como equilibrado.
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

                    {/* Member balances */}
                    {balance ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {balance.members.map((member) => (
                          <div key={member.userId} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                            <p className="truncate text-sm font-semibold text-foreground">{member.name}</p>
                            <p className={`mt-1.5 text-base font-bold ${member.balance >= 0 ? "text-emerald-200" : "text-amber-200"}`}>
                              {formatMoney(Math.abs(member.balance), "ARS", hideAmounts)}
                            </p>
                            <p className="text-xs text-muted-foreground">{member.balance >= 0 ? "cubrió de más" : "por compensar"}</p>
                          </div>
                        ))}
                      </div>
                    ) : isLoadingBalance ? (
                      <div className="flex items-center justify-center py-5">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="text-sm text-muted-foreground">Todavía no hay gastos compartidos.</p>
                        <Button asChild variant="outline" className="mt-3 w-full">
                          <Link href="/transactions?new=1">
                            <Plus className="h-4 w-4" />
                            Agregar gasto compartido
                          </Link>
                        </Button>
                      </div>
                    )}

                    {/* Recent shared transactions */}
                    {balance && balance.recentSharedTransactions.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recientes</p>
                        {balance.recentSharedTransactions.slice(0, 3).map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{tx.description ?? "Gasto compartido"}</p>
                              <p className="truncate text-xs text-muted-foreground">Pagó {tx.paidByName}</p>
                            </div>
                            <p className="shrink-0 text-sm font-bold text-foreground">{formatMoney(tx.amount, tx.currency, hideAmounts)}</p>
                          </div>
                        ))}
                        <Button asChild variant="ghost" size="sm" className="w-full text-muted-foreground">
                          <Link href="/transactions">
                            Ver todos los movimientos
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    ) : null}

                    {/* Settlement history (collapsible) */}
                    {settlements.length > 0 ? (
                      <div className="space-y-2 border-t border-white/[0.07] pt-3">
                        <button
                          type="button"
                          onClick={() => setShowSettlementsHistory((prev) => !prev)}
                          className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:text-foreground"
                        >
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3 w-3" />
                            Historial de equilibrios
                          </span>
                          <span className="font-normal">{showSettlementsHistory ? "ocultar" : `${settlements.length} registrado${settlements.length > 1 ? "s" : ""}`}</span>
                        </button>
                        {showSettlementsHistory ? (
                          <div className="space-y-1.5">
                            {settlements.map((s) => (
                              <div key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/10 bg-emerald-300/5 p-2.5">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-emerald-100">Hogar equilibrado</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {s.settledBy.fullName ?? s.settledBy.email} · {formatDate(s.createdAt)}
                                  </p>
                                </div>
                                <p className="shrink-0 text-xs font-bold text-emerald-200">{formatMoney(Number(s.amount), "ARS", hideAmounts)}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/10 bg-emerald-300/5 p-2.5">
                            <p className="text-xs text-emerald-100/70">Último: {formatDate(settlements[0].createdAt)}</p>
                            <p className="text-xs font-bold text-emerald-200">{formatMoney(Number(settlements[0].amount), "ARS", hideAmounts)}</p>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── PAYMENTS TAB ── */}
            {activeTab === "payments" && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>Pagos del mes</CardTitle>
                      <CardDescription className="capitalize">{currentMonthLabel}</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setIsAddingRecurring((prev) => !prev)}>
                      <Plus className="h-4 w-4" />
                      {isAddingRecurring ? "Cancelar" : "Agregar"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add form */}
                  {isAddingRecurring ? (
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Nombre</Label>
                          <Input
                            value={newPaymentForm.name}
                            onChange={(e) => setNewPaymentForm((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Alquiler, Luz, Internet…"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Monto estimado</Label>
                          <Input
                            type="number"
                            value={newPaymentForm.estimatedAmount}
                            onChange={(e) => setNewPaymentForm((p) => ({ ...p, estimatedAmount: e.target.value }))}
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
                            onChange={(e) => setNewPaymentForm((p) => ({ ...p, dueDay: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>División</Label>
                          <select
                            className="flex h-10 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-base text-foreground md:text-sm"
                            value={newPaymentForm.splitMode}
                            onChange={(e) => setNewPaymentForm((p) => ({ ...p, splitMode: e.target.value as "EQUAL" }))}
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

                  {/* Summary banner */}
                  {recurringPayments && recurringPayments.totalCount > 0 ? (
                    <div className={`rounded-2xl border p-3 ${getRecurringPanelClass(recurringPayments)}`}>
                      <p className="text-sm font-semibold text-foreground">{recurringPayments.summary}</p>
                    </div>
                  ) : null}

                  {/* Payment list */}
                  {isLoadingRecurring ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : recurringPayments?.payments.length ? (
                    <div className="space-y-2">
                      {/* OVERDUE + PENDING (sorted: OVERDUE first, then by dueDay) */}
                      {[...recurringPayments.payments]
                        .filter((p) => p.status !== "PAID")
                        .sort((a, b) => {
                          if (a.status === "OVERDUE" && b.status !== "OVERDUE") return -1;
                          if (a.status !== "OVERDUE" && b.status === "OVERDUE") return 1;
                          return a.dueDay - b.dueDay;
                        })
                        .map((payment) => (
                          <PaymentRow
                            key={payment.id}
                            payment={payment}
                            isExpanded={payingOccurrenceId === payment.id}
                            isPaying={isPaying}
                            payForm={payForm}
                            setPayForm={setPayForm}
                            members={selectedHousehold.members}
                            userAccounts={userAccounts}
                            hideAmounts={hideAmounts}
                            onPay={() => void openPayDialog(payment)}
                            onConfirmPay={() => void confirmMarkAsPaid(payment.id)}
                            onCancel={closePayDialog}
                          />
                        ))}

                      {/* PAID (collapsed) */}
                      {recurringPayments.payments.filter((p) => p.status === "PAID").length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowPaidPayments((prev) => !prev)}
                            className="flex w-full items-center justify-between text-xs text-muted-foreground transition hover:text-foreground"
                          >
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              {recurringPayments.paidCount} ya cubierto{recurringPayments.paidCount > 1 ? "s" : ""}
                            </span>
                            <span>{showPaidPayments ? "ocultar" : "ver"}</span>
                          </button>
                          {showPaidPayments ? (
                            <div className="space-y-1.5">
                              {recurringPayments.payments
                                .filter((p) => p.status === "PAID")
                                .map((payment) => (
                                  <PaymentRow
                                    key={payment.id}
                                    payment={payment}
                                    isExpanded={false}
                                    isPaying={false}
                                    payForm={payForm}
                                    setPayForm={setPayForm}
                                    members={selectedHousehold.members}
                                    userAccounts={userAccounts}
                                    hideAmounts={hideAmounts}
                                    onPay={() => void openPayDialog(payment)}
                                    onConfirmPay={() => void confirmMarkAsPaid(payment.id)}
                                    onCancel={closePayDialog}
                                  />
                                ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-sm font-semibold text-foreground">Sin pagos fijos registrados.</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Agregá el alquiler, la luz o Internet para no perderlos de vista.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── TEAM TAB ── */}
            {activeTab === "team" && (
              <Card>
                <CardHeader>
                  <CardTitle>Miembros</CardTitle>
                  <CardDescription>
                    {selectedHousehold.members.length} {selectedHousehold.members.length === 1 ? "persona" : "personas"} en este hogar
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Members grid */}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedHousehold.members.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-300/15 text-sm font-bold text-teal-100">
                          {(member.userProfile.fullName ?? member.userProfile.email).charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {member.userProfile.fullName ?? member.userProfile.email}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{member.userProfile.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Invite form */}
                  <div id="invite-member" className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="mb-3 text-sm font-semibold text-foreground">Invitar por email</p>
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="persona@email.com"
                      />
                      <Button disabled={isInviting || !email} onClick={() => void inviteMember()}>
                        {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Invitar
                      </Button>
                    </div>

                    {inviteUrl ? (
                      <div className="mt-3 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                        <p className="text-sm font-semibold text-foreground">Copiá y envialo por WhatsApp</p>
                        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
                          <Mail className="h-4 w-4 shrink-0 text-teal-100" />
                          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{inviteUrl}</p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button variant="secondary" onClick={() => void copyInvite()}>
                            {hasCopiedInvite ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {hasCopiedInvite ? "Copiado" : "Copiar link"}
                          </Button>
                          <Button variant="outline" onClick={shareByWhatsApp}>
                            <MessageCircle className="h-4 w-4" />
                            WhatsApp
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
            )}
          </>
        )}
      </section>
    </div>
  );
}

// ── PAYMENT ROW COMPONENT ────────────────────────────────────────────────────

type PaymentRowProps = {
  payment: RecurringPayment;
  isExpanded: boolean;
  isPaying: boolean;
  payForm: { paidByUserId: string; accountId: string; finalAmount: string };
  setPayForm: React.Dispatch<React.SetStateAction<{ paidByUserId: string; accountId: string; finalAmount: string }>>;
  members: Household["members"];
  userAccounts: UserAccount[];
  hideAmounts: boolean;
  onPay: () => void;
  onConfirmPay: () => void;
  onCancel: () => void;
};

function PaymentRow({
  payment,
  isExpanded,
  isPaying,
  payForm,
  setPayForm,
  members,
  userAccounts,
  hideAmounts,
  onPay,
  onConfirmPay,
  onCancel,
}: PaymentRowProps) {
  return (
    <div>
      <div className={`flex items-center gap-3 rounded-2xl border p-3 transition ${getPaymentRowClass(payment.status)}`}>
        {/* Status icon */}
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${getPaymentIconClass(payment.status)}`}>
          {payment.status === "PAID" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : payment.status === "OVERDUE" ? (
            <Clock className="h-4 w-4" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </div>
        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{payment.name}</p>
          <p className="text-xs text-muted-foreground">
            {payment.status === "PAID"
              ? `Pagado${payment.occurrence?.paidAt ? ` · ${formatDate(payment.occurrence.paidAt)}` : ""}`
              : payment.status === "OVERDUE"
              ? `Venció el día ${payment.dueDay}`
              : `Vence el día ${payment.dueDay}`}
          </p>
        </div>
        {/* Amount */}
        <p className="shrink-0 text-sm font-bold text-foreground">
          {formatMoney(payment.occurrence?.finalAmount ?? payment.estimatedAmount, payment.currency, hideAmounts)}
        </p>
        {/* Pay CTA */}
        {payment.status !== "PAID" ? (
          <Button size="sm" variant="ghost" className="shrink-0 text-xs" onClick={onPay}>
            Pagar
          </Button>
        ) : null}
      </div>

      {/* Inline pay form */}
      {isExpanded ? (
        <div className="mt-1 space-y-3 rounded-2xl border border-teal-300/20 bg-teal-300/[0.07] p-4">
          <p className="text-sm font-semibold text-foreground">Registrar pago — {payment.name}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Pagó</Label>
              <select
                className="flex h-10 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-base text-foreground md:text-sm"
                value={payForm.paidByUserId || members[0]?.userProfileId}
                onChange={(e) => setPayForm((p) => ({ ...p, paidByUserId: e.target.value }))}
              >
                {members.map((member) => (
                  <option key={member.userProfileId} value={member.userProfileId}>
                    {member.userProfile.fullName ?? member.userProfile.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Cuenta</Label>
              <select
                className="flex h-10 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-base text-foreground md:text-sm"
                value={payForm.accountId}
                onChange={(e) => setPayForm((p) => ({ ...p, accountId: e.target.value }))}
              >
                <option value="">Elegir cuenta…</option>
                {userAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}{account.householdName ? ` — ${account.householdName}` : ""}
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
              onChange={(e) => setPayForm((p) => ({ ...p, finalAmount: e.target.value }))}
              placeholder={String(payment.estimatedAmount)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={isPaying || !payForm.accountId}
              onClick={onConfirmPay}
            >
              {isPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirmar
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function formatMoney(value: number, currency: "ARS" | "USD", hidden = false) {
  if (hidden) return "$••••";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "ARS" ? 0 : 2,
  }).format(value);
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(dateStr));
}

function getBriefingSummary(briefing: HouseholdBriefing, hidden: boolean) {
  if (!hidden) return briefing.summary;
  if (briefing.status === "STABLE") return "El hogar viene estable este mes.";
  if (briefing.status === "LOW_ACTIVITY") return "Todavía no hay suficientes movimientos compartidos.";
  if (briefing.status === "HIGH_SPEND") return "El gasto compartido viene más alto que lo habitual.";
  if (!briefing.settlement) return "Hay un saldo pendiente por equilibrar.";
  return `${briefing.settlement.fromName} tiene un saldo pendiente con ${briefing.settlement.toName}.`;
}

function getBriefingBadgeClass(status: HouseholdBriefingStatus) {
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

function getRecurringPanelClass(rp: RecurringPaymentsSummary) {
  if (rp.overdueCount > 0) return "border-amber-300/20 bg-amber-300/10";
  if (rp.paidCount === rp.totalCount) return "border-emerald-300/20 bg-emerald-300/10";
  return "border-white/10 bg-white/[0.04]";
}

function getPaymentRowClass(status: "PENDING" | "PAID" | "OVERDUE") {
  if (status === "PAID") return "border-emerald-300/15 bg-emerald-300/[0.06] opacity-70";
  if (status === "OVERDUE") return "border-amber-300/20 bg-amber-300/[0.07]";
  return "border-white/10 bg-white/[0.04]";
}

function getPaymentIconClass(status: "PENDING" | "PAID" | "OVERDUE") {
  if (status === "PAID") return "bg-emerald-300/15 text-emerald-300";
  if (status === "OVERDUE") return "bg-amber-300/15 text-amber-300";
  return "bg-white/[0.07] text-zinc-500";
}
