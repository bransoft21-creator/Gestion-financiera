"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Check, Copy, Home, Loader2, Mail, MessageCircle, Plus, ReceiptText, Send, WalletCards } from "lucide-react";
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
  const [isCreating, setIsCreating] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(false);

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

  useEffect(() => {
    if (!selectedHousehold) return;
    const timer = window.setTimeout(() => {
      void loadBriefing(selectedHousehold.id);
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
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Brandon & Zoirelys" />
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
                    setInviteUrl("");
                    setHasCopiedInvite(false);
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
                    Marcá un gasto como compartido desde Movimientos para empezar.
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
