"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { invalidateFinancialData } from "@/lib/invalidate";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgreementDirection = "LENT" | "BORROWED" | "SHARED";
export type AgreementStatus = "OPEN" | "PARTIAL" | "OVERDUE" | "CLOSED" | "FORGIVEN" | "CANCELED";
export type AgreementCategory = "PERSONAL" | "FAMILY" | "WORK" | "SOCIAL" | "OTHER";
export type AgreementEventType =
  | "PAYMENT_RECEIVED"
  | "PAYMENT_SENT"
  | "INTEREST_APPLIED"
  | "DATE_EXTENDED"
  | "REFINANCED"
  | "PARTIAL_FORGIVEN"
  | "NOTE_ADDED"
  | "CLOSED"
  | "CANCELED";

export type AgreementEvent = {
  id: string;
  agreementId: string;
  type: AgreementEventType;
  amount: number | null;
  currency: string | null;
  description: string | null;
  transactionId: string | null;
  occurredAt: string;
  createdAt: string;
};

export type AgreementContact = {
  id: string;
  name: string;
  alias: string | null;
  avatarColor: string | null;
};

export type AgreementItem = {
  id: string;
  householdId: string;
  contactId: string;
  contact: AgreementContact;
  direction: AgreementDirection;
  status: AgreementStatus;
  currency: string;
  originalAmount: number;
  currentBalance: number;
  paidPercent: number;
  description: string | null;
  category: AgreementCategory;
  agreedReturnDate: string | null;
  occurredAt: string;
  hasInterest: boolean;
  interestType: "FIXED" | "PERCENTAGE" | null;
  interestAmount: number | null;
  interestRate: number | null;
  expectedInstallments: number | null;
  sourceAccountId: string | null;
  closedAt: string | null;
  notes: string | null;
  events: AgreementEvent[];
  createdAt: string;
  updatedAt: string;
};

export type AgreementsSummary = {
  totalToReceive: number;
  totalToPay: number;
  netPosition: number;
  activeCount: number;
  overdueCount: number;
};

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchAgreements(
  householdId: string,
  filters?: { direction?: string; status?: string; contactId?: string },
): Promise<{ agreements: AgreementItem[]; summary: AgreementsSummary }> {
  const params = new URLSearchParams({ householdId });
  if (filters?.direction) params.set("direction", filters.direction);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.contactId) params.set("contactId", filters.contactId);

  const res = await fetch(`/api/agreements?${params}`);
  const payload = (await res.json()) as {
    data?: { agreements: AgreementItem[]; summary: AgreementsSummary };
    error?: string;
  };
  if (!res.ok) throw new Error(payload.error ?? "No se pudieron cargar los acuerdos.");
  return payload.data ?? { agreements: [], summary: { totalToReceive: 0, totalToPay: 0, netPosition: 0, activeCount: 0, overdueCount: 0 } };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAgreements(
  householdId: string,
  filters?: { direction?: string; status?: string; contactId?: string },
) {
  return useQuery({
    queryKey: queryKeys.agreements.list(householdId, filters as Record<string, string>),
    queryFn: () => fetchAgreements(householdId, filters),
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Create agreement
// ---------------------------------------------------------------------------

type CreateAgreementInput = {
  householdId: string;
  contactId: string;
  direction: AgreementDirection;
  currency: string;
  originalAmount: number;
  description?: string | null;
  category?: AgreementCategory;
  agreedReturnDate?: string | null;
  occurredAt: string;
  hasInterest?: boolean;
  interestType?: "FIXED" | "PERCENTAGE" | null;
  interestAmount?: number | null;
  interestRate?: number | null;
  expectedInstallments?: number | null;
  sourceAccountId?: string | null;
  notes?: string | null;
};

export function useCreateAgreement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAgreementInput): Promise<AgreementItem> => {
      const res = await fetch("/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await res.json()) as { data?: AgreementItem; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Error al crear el acuerdo.");
      return payload.data!;
    },
    onSuccess: () => {
      invalidateFinancialData(queryClient, "agreementChanged");
      toast.success("Acuerdo registrado");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ---------------------------------------------------------------------------
// Register payment event
// ---------------------------------------------------------------------------

type CreateEventInput = {
  agreementId: string;
  householdId: string;
  type: AgreementEventType;
  amount?: number | null;
  currency?: string | null;
  description?: string | null;
  accountId?: string | null;
  occurredAt: string;
};

export function useCreateAgreementEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEventInput): Promise<AgreementItem> => {
      const { agreementId, ...body } = input;
      const res = await fetch(`/api/agreements/${agreementId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as { data?: AgreementItem; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Error al registrar el movimiento.");
      return payload.data!;
    },
    onSuccess: () => {
      invalidateFinancialData(queryClient, "agreementChanged");
      toast.success("Movimiento registrado");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ---------------------------------------------------------------------------
// Close agreement
// ---------------------------------------------------------------------------

type CloseAgreementInput = {
  agreementId: string;
  closeType: "CLOSED" | "FORGIVEN" | "CANCELED";
  notes?: string | null;
};

export function useCloseAgreement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CloseAgreementInput): Promise<AgreementItem> => {
      const { agreementId, ...body } = input;
      const res = await fetch(`/api/agreements/${agreementId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as { data?: AgreementItem; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Error al cerrar el acuerdo.");
      return payload.data!;
    },
    onSuccess: (_, vars) => {
      invalidateFinancialData(queryClient, "agreementChanged");
      const labels: Record<string, string> = {
        CLOSED: "Acuerdo cerrado",
        FORGIVEN: "Acuerdo condonado",
        CANCELED: "Acuerdo cancelado",
      };
      toast.success(labels[vars.closeType] ?? "Acuerdo actualizado");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
