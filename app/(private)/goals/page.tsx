import { PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/server/auth/current-user";
import { getGoalWorkspace } from "@/server/services/workspace";
import { GoalsClient } from "./goals-client";

export default async function GoalsPage() {
  const { userProfile } = await getCurrentUser();
  const workspace = await getGoalWorkspace(userProfile.id);

  return (
    <>
      <PageHeader
        title="Metas"
        description="Objetivos de ahorro y progreso acumulado. Metas activas con aporte mensual definido se incluyen como obligación en el dashboard."
      />
      <GoalsClient householdId={workspace.household.id} accounts={workspace.accounts} />
    </>
  );
}
