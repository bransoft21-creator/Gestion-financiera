import { V2PageShell } from "@/components/layout/v2-page-shell";
import { getCurrentUser } from "@/server/auth/current-user";
import { getGoalWorkspace } from "@/server/services/workspace";
import { GoalsClient } from "./goals-client";

export default async function GoalsPage() {
  const { userProfile } = await getCurrentUser();
  const workspace = await getGoalWorkspace(userProfile.id);

  return (
    <V2PageShell
      eyebrow="Hitos financieros"
      title="Tus próximos movimientos importantes"
      description="Seguís ahorro, fechas y aportes como una historia de progreso, no como una lista de tareas."
    >
      <GoalsClient householdId={workspace.household.id} accounts={workspace.accounts} />
    </V2PageShell>
  );
}
