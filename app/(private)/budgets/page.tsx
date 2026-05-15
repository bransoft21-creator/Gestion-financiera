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
      title="Meridian preparó una base para tu mes"
      description="Una distribución editable basada en ingresos recientes, hábitos y compromisos recurrentes."
    >
      <BudgetsClient householdId={workspace.household.id} categories={workspace.categories} defaultCurrency={userProfile.currency as "ARS" | "USD"} />
    </V2PageShell>
  );
}
