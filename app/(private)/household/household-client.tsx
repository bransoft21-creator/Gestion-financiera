"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, Circle, Clock, Copy, Home, Loader2, Mail, MessageCircle, Plus, Send, Users, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useHideAmounts } from "@/hooks/use-hide-amounts";
import { trackProductEvent } from "@/lib/observability/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentRow } from "@/components/household/payment-row";
import { SensitiveAmount, SensitiveText } from "@/components/app/sensitive-amount";
import {
  formatMoney,
  formatDate,
  getBriefingSummary,
  getBriefingBadgeClass,
  getBriefingPanelClass,
  getRecurringPanelClass,
} from "./utils";
import type {
  Household,
  HouseholdBalance,
  HouseholdBriefing,
  HouseholdBriefingStatus,
  HouseholdSettlement,
  HouseholdTab,
  PayForm,
  RecurringPayment,
  RecurringPaymentsSummary,
  UserAccount,
} from "./types";

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
  const [showAllActivePayments, setShowAllActivePayments] = useState(false);
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
  const [payForm, setPayForm] = useState<PayForm>({ paidByUserId: "", accountId: "", finalAmount: "" });
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
    setShowAllActivePayments(false);
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
      trackProductEvent("household_created", {}, "household");
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
      trackProductEvent("household_invite_created", {}, "household");
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
      trackProductEvent("settlement_created", {}, "household");
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
    setPayForm({ paidByUserId: "", accountId: userAccounts[0]?.id ?? "", finalAmount: hideAmounts ? "" : String(payment.estimatedAmount) });
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
      trackProductEvent("recurring_payment_paid", {}, "household");
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
      toast.success("Pago del hogar agregado.");
      trackProductEvent("recurring_payment_created", {}, "household");
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
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-muted/60 text-2xl">🏠</div>
          <h2 className="text-lg font-semibold text-foreground">Creá tu hogar compartido</h2>
          <p className="mt-1 text-sm text-muted-foreground">Invitá a tu pareja o familia para organizar gastos juntos.</p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 p-5 space-y-4">
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
                : "border-border bg-muted/30 hover:bg-muted/60"
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-base">
              {household.avatar || <Home className="h-4 w-4" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{household.name}</span>
              <span className="text-xs text-muted-foreground">{household.members.length} personas</span>
            </span>
          </button>
        ))}

        {showCreateForm ? (
          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
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
            className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground transition hover:border-border hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo hogar
          </button>
        )}
      </section>

      {/* ── MAIN CONTENT ── */}
      <section className="space-y-4 min-w-0">
        {!selectedHousehold ? (
          <div className="rounded-2xl border border-border bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">Seleccioná un hogar para continuar.</p>
          </div>
        ) : (
          <>
            {/* Household header */}
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted/60 text-lg">
                {selectedHousehold.avatar || <Home className="h-5 w-5" />}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-foreground">{selectedHousehold.name}</h2>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {selectedHousehold.members.slice(0, 5).map((member) => (
                    <span
                      key={member.id}
                      title={member.userProfile.fullName ?? member.userProfile.email}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-300/20 text-[10px] font-bold text-primary"
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
            <div className="flex gap-1 rounded-2xl border border-border bg-muted/30 p-1">
              {(["overview", "payments", "team"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    activeTab === tab
                      ? "bg-muted text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "overview" && <WalletCards className="h-3.5 w-3.5" />}
                  {tab === "payments" && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {tab === "team" && <Users className="h-3.5 w-3.5" />}
                  <span>{tab === "overview" ? "Resumen" : tab === "payments" ? "Pagos" : "Equipo"}</span>
                </button>
              ))}
            </div>

            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* Briefing banner */}
                <div className={`rounded-2xl border p-4 ${getBriefingPanelClass(briefing?.status)}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/70">
                      {isLoadingBriefing
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <WalletCards className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {briefing
                          ? <SensitiveText text={getBriefingSummary(briefing, hideAmounts)} />
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
                        <CardTitle className="text-base">Cómo está repartido</CardTitle>
                        {balance?.lastSettledAt ? (
                          <CardDescription>Desde el último equilibrio, {formatDate(balance.lastSettledAt)}</CardDescription>
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
                          className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground"
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
                        <p className="text-sm font-semibold text-amber-500">
                          {balance.settlement.fromName} le debe{" "}
                          <SensitiveAmount value={formatMoney(balance.settlement.amount, "ARS")} />{" "}
                          a {balance.settlement.toName}.
                        </p>
                        <p className="mt-1 text-xs leading-5 text-amber-500/70">
                          Cuando lo compensen fuera de Meridian, dejá constancia para empezar de nuevo.
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
                          <div key={member.userId} className="rounded-2xl border border-border bg-muted/30 p-3">
                            <p className="truncate text-sm font-semibold text-foreground">{member.name}</p>
                            <p className={`mt-1.5 text-base font-bold ${member.balance >= 0 ? "text-emerald-200" : "text-amber-200"}`}>
                              <SensitiveAmount value={formatMoney(Math.abs(member.balance), "ARS")} />
                            </p>
                            <p className="text-xs text-muted-foreground">{member.balance >= 0 ? "aportó más al hogar" : "queda por compensar"}</p>
                          </div>
                        ))}
                      </div>
                    ) : isLoadingBalance ? (
                      <div className="flex items-center justify-center py-5">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-border bg-muted/15 p-5 text-center">
                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/50 text-lg">💸</div>
                        <p className="text-sm font-semibold text-foreground">Sin movimientos compartidos</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Cuando alguien pague algo para el hogar, aparecerá acá.
                        </p>
                        <Button asChild variant="outline" size="sm" className="mt-4 w-full">
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
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Últimos gastos compartidos</p>
                        {balance.recentSharedTransactions.slice(0, 3).map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{tx.description ?? "Gasto compartido"}</p>
                              <p className="truncate text-xs text-muted-foreground">Pagó {tx.paidByName}</p>
                            </div>
                            <p className="shrink-0 text-sm font-bold text-foreground">
                              <SensitiveAmount value={formatMoney(tx.amount, tx.currency)} />
                            </p>
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
                      <div className="space-y-2 border-t border-border pt-3">
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
                                  <p className="text-xs font-semibold text-emerald-400">Hogar equilibrado</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {s.settledBy.fullName ?? s.settledBy.email} · {formatDate(s.createdAt)}
                                  </p>
                                </div>
                                <p className="shrink-0 text-xs font-bold text-emerald-200">
                                  <SensitiveAmount value={formatMoney(Number(s.amount), "ARS")} />
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/10 bg-emerald-300/5 p-2.5">
                            <p className="text-xs text-emerald-400/70">Último: {formatDate(settlements[0].createdAt)}</p>
                            <p className="text-xs font-bold text-emerald-200">
                              <SensitiveAmount value={formatMoney(Number(settlements[0].amount), "ARS")} />
                            </p>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {/* Monthly timeline — editorial financial memory */}
                {(recurringPayments?.payments.some((p) => p.status === "PAID") ||
                  settlements.length > 0 ||
                  briefing?.status === "HIGH_SPEND") ? (
                  <div className="space-y-2.5 rounded-2xl border border-border bg-muted/15 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground capitalize">Historia del mes · {currentMonthLabel}</p>
                    <div className="space-y-2">
                      {settlements[0] ? (
                        <div className="flex items-start gap-2.5 text-xs text-emerald-200/80">
                          <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
                          Hogar equilibrado el {formatDate(settlements[0].createdAt)}
                        </div>
                      ) : null}
                      {recurringPayments?.payments
                        .filter((p) => p.status === "PAID")
                        .map((p) => (
                          <div key={p.id} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                            <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/50" />
                            {p.name} cubierto
                          </div>
                        ))}
                      {briefing?.status === "HIGH_SPEND" ? (
                        <div className="flex items-start gap-2.5 text-xs text-sky-300/70">
                          <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400/60" />
                          El gasto compartido viene más alto que lo habitual
                        </div>
                      ) : null}
                      {briefing?.status === "STABLE" &&
                       recurringPayments &&
                       recurringPayments.totalCount > 0 &&
                       recurringPayments.paidCount === recurringPayments.totalCount ? (
                        <div className="flex items-start gap-2.5 text-xs text-emerald-200/70">
                          <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
                          Todos los pagos del mes cubiertos
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* ── PAYMENTS TAB ── */}
            {activeTab === "payments" && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                  <CardTitle>Compromisos del hogar</CardTitle>
                      <CardDescription className="capitalize">
                        {currentMonthLabel} · fijos, servicios y compras compartidas
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href="/transactions?new=1">
                          <Plus className="h-4 w-4" />
                          Gasto puntual
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setIsAddingRecurring((prev) => !prev)}>
                        <Plus className="h-4 w-4" />
                        {isAddingRecurring ? "Cancelar" : "Pago fijo"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-teal-300/15 bg-teal-300/10 p-3">
                    <p className="text-sm font-semibold text-teal-50">Los pagos del hogar no tienen que ser todos fijos.</p>
                    <p className="mt-1 text-xs leading-5 text-primary/70">
                      Usá “Gasto puntual” para supermercado, farmacia o compras sueltas. Usá “Pago fijo” para alquiler, servicios o compromisos que vuelven cada mes.
                    </p>
                  </div>
                  {/* Add form */}
                  {isAddingRecurring ? (
                    <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Nombre</Label>
                          <Input
                            value={newPaymentForm.name}
                            onChange={(e) => setNewPaymentForm((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Alquiler, luz, Internet, expensas…"
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
                            className="flex h-10 w-full rounded-2xl border border-border bg-muted/30 px-3 py-2 text-base text-foreground md:text-sm"
                            value={newPaymentForm.splitMode}
                            onChange={(e) => setNewPaymentForm((p) => ({ ...p, splitMode: e.target.value as "EQUAL" }))}
                          >
                            <option value="EQUAL">Partes iguales</option>
                            <option value="PERCENTAGE">Porcentaje</option>
                            <option value="CUSTOM_AMOUNT">Monto acordado</option>
                          </select>
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        disabled={isCreatingRecurring || !newPaymentForm.name.trim() || !newPaymentForm.estimatedAmount}
                        onClick={() => void createRecurringPayment()}
                      >
                        {isCreatingRecurring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Guardar pago fijo
                      </Button>
                    </div>
                  ) : null}

                  {/* Summary banner */}
                  {recurringPayments && recurringPayments.totalCount > 0 ? (
                    <div className={`rounded-2xl border p-3 ${getRecurringPanelClass(recurringPayments)}`}>
                      <p className="text-sm font-semibold text-foreground">
                        <SensitiveText text={recurringPayments.summary} />
                      </p>
                    </div>
                  ) : null}

                  {/* Payment list */}
                  {isLoadingRecurring ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : recurringPayments?.payments.length ? (
                    <div className="space-y-2">
                      {/* OVERDUE + PENDING (sorted: OVERDUE first, then by dueDay; capped at 8) */}
                      {(() => {
                        const sorted = [...recurringPayments.payments]
                          .filter((p) => p.status !== "PAID")
                          .sort((a, b) => {
                            if (a.status === "OVERDUE" && b.status !== "OVERDUE") return -1;
                            if (a.status !== "OVERDUE" && b.status === "OVERDUE") return 1;
                            return a.dueDay - b.dueDay;
                          });
                        const visible = showAllActivePayments ? sorted : sorted.slice(0, 8);
                        const hidden = sorted.length - visible.length;
                        return (
                          <>
                            {visible.map((payment) => (
                              <PaymentRow
                                key={payment.id}
                                payment={payment}
                                isExpanded={payingOccurrenceId === payment.id}
                                isPaying={isPaying}
                                payForm={payForm}
                                setPayForm={setPayForm}
                                members={selectedHousehold.members}
                                userAccounts={userAccounts}
                                onPay={() => void openPayDialog(payment)}
                                onConfirmPay={() => void confirmMarkAsPaid(payment.id)}
                                onCancel={closePayDialog}
                              />
                            ))}
                            {hidden > 0 ? (
                              <button
                                type="button"
                                onClick={() => setShowAllActivePayments(true)}
                                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-border py-2.5 text-xs text-muted-foreground transition hover:text-foreground"
                              >
                                Ver {hidden} pago{hidden > 1 ? "s" : ""} más
                              </button>
                            ) : null}
                          </>
                        );
                      })()}

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
                    <div className="rounded-2xl border border-border bg-muted/15 p-5 text-center">
                      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/50 text-lg">📋</div>
                      <p className="text-sm font-semibold text-foreground">Todavía no hay compromisos del hogar</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Agregá los pagos que vuelven todos los meses o cargá un gasto puntual cuando alguien pague algo compartido.
                      </p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <Button asChild variant="outline" size="sm" className="w-full">
                          <Link href="/transactions?new=1">
                            <Plus className="h-4 w-4" />
                            Gasto puntual
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setIsAddingRecurring(true)}
                        >
                          <Plus className="h-4 w-4" />
                          Pago fijo
                        </Button>
                      </div>
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
                    {selectedHousehold.members.length} {selectedHousehold.members.length === 1 ? "persona" : "personas"}
                    {selectedHousehold.invites.length > 0 ? ` · ${selectedHousehold.invites.length} invitación${selectedHousehold.invites.length > 1 ? "es" : ""} pendiente${selectedHousehold.invites.length > 1 ? "s" : ""}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Members grid */}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selectedHousehold.members.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-300/15 text-sm font-bold text-primary">
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
                  <div id="invite-member" className="scroll-mt-24 rounded-2xl border border-border bg-muted/30 p-4">
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
                      <div className="mt-3 space-y-3 rounded-2xl border border-border bg-muted/50 p-3">
                        <p className="text-sm font-semibold text-foreground">Copiá y envialo por WhatsApp</p>
                        <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/30 p-2">
                          <Mail className="h-4 w-4 shrink-0 text-primary" />
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
