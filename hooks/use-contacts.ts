"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { invalidateFinancialData } from "@/lib/invalidate";

export type ContactItem = {
  id: string;
  householdId: string;
  name: string;
  alias: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  avatarColor: string | null;
  totalLentToThem: number;
  totalBorrowedFromThem: number;
  avgReturnDays: number | null;
  agreementCount: number;
  createdAt: string;
  updatedAt: string;
};

async function fetchContacts(householdId: string, search?: string): Promise<ContactItem[]> {
  const params = new URLSearchParams({ householdId });
  if (search) params.set("search", search);
  const res = await fetch(`/api/contacts?${params}`);
  const payload = (await res.json()) as { data?: ContactItem[]; error?: string };
  if (!res.ok) throw new Error(payload.error ?? "No se pudieron cargar los contactos.");
  return payload.data ?? [];
}

export function useContacts(householdId: string, search?: string) {
  return useQuery({
    queryKey: queryKeys.contacts.list(householdId, search),
    queryFn: () => fetchContacts(householdId, search),
    staleTime: 60_000,
  });
}

type CreateContactInput = {
  householdId: string;
  name: string;
  alias?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateContactInput) => {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = (await res.json()) as { data?: ContactItem; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Error al crear el contacto.");
      return payload.data!;
    },
    onSuccess: () => {
      invalidateFinancialData(queryClient, "contactChanged");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
