import { PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/server/auth/current-user";
import { getBudgetWorkspace } from "@/server/services/workspace";
import { BudgetsClient } from "./budgets-client";

export default async function BudgetsPage() {
  const { userProfile } = await getCurrentUser();
  const workspace = await getBudgetWorkspace(userProfile.id);

  return (
    <>
      <PageHeader
        title="Presupuestos"
        description="Plan mensual por categoría para reservar dinero antes de calcular disponibilidad real."
      />
      <BudgetsClient householdId={workspace.household.id} categories={workspace.categories} />
    </>
  );
}
