import { V2PageShell } from "@/components/layout/v2-page-shell";
import { getCurrentUser } from "@/server/auth/current-user";
import { getTransactionWorkspace } from "@/server/services/workspace";
import { TransactionsClient } from "./transactions-client";

export default async function TransactionsPage() {
  const { userProfile } = await getCurrentUser();
  const workspace = await getTransactionWorkspace(userProfile.id);

  return (
    <V2PageShell
      title="Movimientos"
      description="Entradas, salidas y patrones del período."
    >
      <TransactionsClient
        householdId={workspace.household.id}
        accounts={workspace.accounts}
        categories={workspace.categories}
        sharedHouseholds={workspace.sharedHouseholds}
        defaultCurrency={userProfile.currency as "ARS" | "USD"}
      />
    </V2PageShell>
  );
}
