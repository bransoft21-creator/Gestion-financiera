import { V2PageShell } from "@/components/layout/v2-page-shell";
import { getCurrentUser } from "@/server/auth/current-user";
import { getBudgetWorkspace } from "@/server/services/workspace";
import { BudgetsClient } from "./budgets-client";

export default async function BudgetsPage() {
  const { userProfile } = await getCurrentUser();
  const workspace = await getBudgetWorkspace(userProfile.id);

  return (
    <V2PageShell
      eyebrow="Plan del mes"
      title="Protegé tu dinero antes de gastarlo"
      description="Asigná intención a cada categoría y seguí el ritmo real del mes sin convertirlo en una planilla."
    >
      <BudgetsClient householdId={workspace.household.id} categories={workspace.categories} />
    </V2PageShell>
  );
}
