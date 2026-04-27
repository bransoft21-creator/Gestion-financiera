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
        description="Objetivos de ahorro y progreso acumulado. Todavía no afectan el cálculo de disponible real."
      />
      <GoalsClient householdId={workspace.household.id} />
    </>
  );
}
