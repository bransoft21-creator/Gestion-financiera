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
      title="Lo que pesa sobre tu mes"
      description="Seguís deuda, vencimientos y pagos mínimos como compromisos vivos, no como un listado frío."
    >
      <DebtsClient householdId={household.id} accounts={accounts} />
    </V2PageShell>
  );
}
