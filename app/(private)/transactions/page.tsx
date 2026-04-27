import { PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/server/auth/current-user";
import { getTransactionWorkspace } from "@/server/services/workspace";
import { TransactionsClient } from "./transactions-client";

export default async function TransactionsPage() {
  const { userProfile } = await getCurrentUser();
  const workspace = await getTransactionWorkspace(userProfile.id);

  return (
    <>
      <PageHeader
        title="Transacciones"
        description="Registro central de ingresos, gastos, transferencias, ajustes y movimientos vinculados."
      />
      <TransactionsClient
        householdId={workspace.household.id}
        accounts={workspace.accounts}
        categories={workspace.categories}
      />
    </>
  );
}
