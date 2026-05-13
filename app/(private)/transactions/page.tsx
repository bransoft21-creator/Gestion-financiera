import { V2PageShell } from "@/components/layout/v2-page-shell";
import { getCurrentUser } from "@/server/auth/current-user";
import { getTransactionWorkspace } from "@/server/services/workspace";
import { TransactionsClient } from "./transactions-client";

export default async function TransactionsPage() {
  const { userProfile } = await getCurrentUser();
  const workspace = await getTransactionWorkspace(userProfile.id);

  return (
    <V2PageShell
      eyebrow="Money feed"
      title="Movimientos"
      description="Tu línea de tiempo financiera: qué entró, qué salió y qué patrón empieza a aparecer."
    >
      <TransactionsClient
        householdId={workspace.household.id}
        accounts={workspace.accounts}
        categories={workspace.categories}
        sharedHouseholds={workspace.sharedHouseholds}
      />
    </V2PageShell>
  );
}
