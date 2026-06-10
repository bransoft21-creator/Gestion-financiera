import { V2PageShell } from "@/components/layout/v2-page-shell";
import { getCurrentUser } from "@/server/auth/current-user";
import { getCommitmentsWorkspace } from "@/server/services/workspace";
import { CommitmentsClient } from "./commitments-client";

export default async function CommitmentsPage() {
  const { userProfile } = await getCurrentUser();
  const { household } = await getCommitmentsWorkspace(userProfile.id);

  return (
    <V2PageShell
      eyebrow="Plan y compromisos"
      title="Compromisos del mes"
      description="Todos tus vencimientos en un solo lugar: recurrentes, cuotas y pagos del hogar."
    >
      <CommitmentsClient householdId={household.id} />
    </V2PageShell>
  );
}
