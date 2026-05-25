import { V2PageShell } from "@/components/layout/v2-page-shell";
import { getCurrentUser } from "@/server/auth/current-user";
import { getDebtWorkspace } from "@/server/services/workspace";
import { DebtsClient } from "./debts-client";

export default async function DebtsPage() {
  const { userProfile } = await getCurrentUser();
  const { household, accounts } = await getDebtWorkspace(userProfile.id);

  return (
    <V2PageShell
      eyebrow="Compromisos financieros"
      title="Créditos y cuotas"
      description="Seguís saldos formales, vencimientos y pagos mínimos como compromisos vivos, separados del dinero entre personas."
    >
      <DebtsClient householdId={household.id} accounts={accounts} defaultCurrency={userProfile.currency as "ARS" | "USD"} />
    </V2PageShell>
  );
}
