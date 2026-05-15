import { V2PageShell } from "@/components/layout/v2-page-shell";
import { getCurrentUser } from "@/server/auth/current-user";
import { getAccountWorkspace } from "@/server/services/workspace";
import { AccountsClient } from "./accounts-client";

export default async function AccountsPage() {
  const { userProfile } = await getCurrentUser();
  const { household } = await getAccountWorkspace(userProfile.id);

  return (
    <V2PageShell
      eyebrow="Dinero actual"
      title="Lo que tenés, lo que debés y lo que queda"
      description="Balances reales, deuda pendiente y patrimonio neto en una lectura simple del presente."
    >
      <AccountsClient householdId={household.id} defaultCurrency={userProfile.currency as "ARS" | "USD"} />
    </V2PageShell>
  );
}
