import { PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/server/auth/current-user";
import { getDebtWorkspace } from "@/server/services/workspace";
import { DebtsClient } from "./debts-client";

export default async function DebtsPage() {
  const { userProfile } = await getCurrentUser();
  const { household } = await getDebtWorkspace(userProfile.id);

  return (
    <>
      <PageHeader
        title="Deudas"
        description="Préstamos, tarjetas de crédito y cuotas. Seguimiento de saldo pendiente, pagos mínimos y vencimientos."
      />
      <DebtsClient householdId={household.id} />
    </>
  );
}
