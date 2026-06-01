"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExternalParticipant, Household, UserAccount } from "@/app/(private)/household/types";

type Props = {
  household: Household;
  userAccounts: UserAccount[];
  onSuccess: (result: { transactionId: string; userShare: number; totalAmount: number }) => void;
  onCancel: () => void;
};

type Participant =
  | { kind: "member"; id: string; name: string }
  | { kind: "external"; id: string; name: string };

export function OneTimeExpenseForm({ household, userAccounts, onSuccess, onCancel }: Props) {
  const activeMembers = household.members.filter((m) => m.status === "ACTIVE");
  const externals: ExternalParticipant[] = household.externalParticipants ?? [];

  const allParticipants: Participant[] = [
    ...activeMembers.map((m) => ({
      kind: "member" as const,
      id: m.userProfileId,
      name: m.userProfile.fullName ?? m.userProfile.email,
    })),
    ...externals.map((ep) => ({
      kind: "external" as const,
      id: ep.id,
      name: ep.name,
    })),
  ];

  const [form, setForm] = useState({
    description: "",
    amount: "",
    currency: "ARS" as "ARS" | "USD",
    accountId: userAccounts[0]?.id ?? "",
    splitMode: "EQUAL" as "EQUAL" | "PERCENTAGE" | "CUSTOM_AMOUNT",
    occurredAt: new Date().toISOString().slice(0, 10),
  });
  const [customSplits, setCustomSplits] = useState<Record<string, string>>(
    Object.fromEntries(allParticipants.map((p) => [p.id, ""])),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalAmount = Number(form.amount) || 0;

  function updateSplit(id: string, value: string) {
    setCustomSplits((prev) => ({ ...prev, [id]: value }));
  }

  function buildParticipants() {
    if (form.splitMode === "EQUAL") return undefined;
    return allParticipants.map((p) => ({
      ...(p.kind === "member" ? { userId: p.id } : { externalParticipantId: p.id }),
      value: Number(customSplits[p.id] ?? 0),
    }));
  }

  async function handleSubmit() {
    if (!form.description.trim() || !totalAmount || !form.accountId) return;
    setIsSubmitting(true);
    try {
      const participants = buildParticipants();
      const res = await fetch("/api/households/shared-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: household.id,
          description: form.description.trim(),
          amount: totalAmount,
          currency: form.currency,
          accountId: form.accountId,
          splitMode: form.splitMode,
          participants,
          occurredAt: new Date(form.occurredAt + "T12:00:00").toISOString(),
        }),
      });
      const payload = (await res.json()) as { data?: { transactionId: string }; error?: string };
      if (!res.ok) {
        const { toast } = await import("sonner");
        toast.error(payload.error ?? "No se pudo registrar el gasto.");
        return;
      }

      let userShare = totalAmount;
      if (form.splitMode === "EQUAL" && allParticipants.length > 1) {
        userShare = totalAmount / allParticipants.length;
      }

      onSuccess({
        transactionId: payload.data!.transactionId,
        userShare: Math.round(userShare * 100) / 100,
        totalAmount,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = form.description.trim().length > 0 && totalAmount > 0 && form.accountId;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Descripción</Label>
          <Input
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Supermercado, farmacia, salida…"
          />
        </div>
        <div className="space-y-2">
          <Label>Monto</Label>
          <Input
            type="number"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label>Fecha</Label>
          <Input
            type="date"
            value={form.occurredAt}
            onChange={(e) => setForm((p) => ({ ...p, occurredAt: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Cuenta de origen</Label>
          <select
            className="flex h-10 w-full rounded-2xl border border-border bg-muted/30 px-3 py-2 text-base text-foreground md:text-sm"
            value={form.accountId}
            onChange={(e) => setForm((p) => ({ ...p, accountId: e.target.value }))}
          >
            {userAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>División</Label>
          <select
            className="flex h-10 w-full rounded-2xl border border-border bg-muted/30 px-3 py-2 text-base text-foreground md:text-sm"
            value={form.splitMode}
            onChange={(e) => setForm((p) => ({ ...p, splitMode: e.target.value as "EQUAL" | "PERCENTAGE" | "CUSTOM_AMOUNT" }))}
          >
            <option value="EQUAL">Partes iguales</option>
            <option value="PERCENTAGE">Porcentaje</option>
            <option value="CUSTOM_AMOUNT">Monto acordado</option>
          </select>
        </div>
      </div>

      {form.splitMode !== "EQUAL" && allParticipants.length > 0 && (
        <div className="space-y-2">
          <Label>{form.splitMode === "PERCENTAGE" ? "Porcentaje por persona" : "Monto por persona"}</Label>
          <div className="space-y-2">
            {allParticipants.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {p.name}
                  {p.kind === "external" && (
                    <span className="ml-1 text-xs text-muted-foreground/60">(externo)</span>
                  )}
                </span>
                <Input
                  type="number"
                  className="w-28"
                  value={customSplits[p.id] ?? ""}
                  onChange={(e) => updateSplit(p.id, e.target.value)}
                  placeholder={form.splitMode === "PERCENTAGE" ? "50" : "0"}
                />
                <span className="text-sm text-muted-foreground">
                  {form.splitMode === "PERCENTAGE" ? "%" : form.currency}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {form.splitMode === "EQUAL" && allParticipants.length > 1 && totalAmount > 0 && (
        <p className="text-xs text-muted-foreground">
          Cada persona: {new Intl.NumberFormat("es-AR", { style: "currency", currency: form.currency, maximumFractionDigits: 0 }).format(totalAmount / allParticipants.length)}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          className="flex-1"
          disabled={!canSubmit || isSubmitting}
          onClick={() => void handleSubmit()}
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Registrar gasto
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
