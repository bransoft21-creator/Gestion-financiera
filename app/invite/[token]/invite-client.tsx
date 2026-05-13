"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Home, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type InvitePreview = {
  email: string;
  status: string;
  household: {
    name: string;
    avatar: string | null;
  };
  invitedBy: {
    fullName: string | null;
    email: string;
  };
};

export function InviteClient({ token }: { token: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    async function loadInvite() {
      try {
        const response = await fetch(`/api/invites/${token}`);
        const payload = (await response.json()) as { data?: InvitePreview; error?: string };

        if (!response.ok || !payload.data) {
          setError(payload.error ?? "No pudimos encontrar esta invitación.");
          return;
        }

        setInvite(payload.data);
      } finally {
        setIsLoading(false);
      }
    }

    void loadInvite();
  }, [token]);

  async function acceptInvite() {
    setIsAccepting(true);
    setError("");

    try {
      const response = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "No se pudo aceptar la invitación.");
        return;
      }

      toast.success("Te sumaste al hogar.");
      router.replace("/household");
    } finally {
      setIsAccepting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando invitación...
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
        {error || "La invitación no está disponible."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.07] text-lg">
          {invite.household.avatar || <Home className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{invite.household.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            Invitó {invite.invitedBy.fullName ?? invite.invitedBy.email}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate">Para {invite.email}</span>
        <Badge>{invite.status === "PENDING" ? "Pendiente" : invite.status}</Badge>
      </div>

      <Button className="w-full" onClick={() => void acceptInvite()} disabled={isAccepting || invite.status !== "PENDING"}>
        {isAccepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Aceptar invitación
      </Button>
    </div>
  );
}
