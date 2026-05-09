import { V2PageShell } from "@/components/layout/v2-page-shell";
import { getCurrentUser } from "@/server/auth/current-user";
import { getReportsWorkspace } from "@/server/services/workspace";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const { userProfile } = await getCurrentUser();
  const { household } = await getReportsWorkspace(userProfile.id);

  return (
    <V2PageShell
      eyebrow="Memoria financiera"
      title="Lo que tu dinero viene contando"
      description="Tendencias, meses clave y patrones de gasto para entender tu historia financiera sin leer tablas."
    >
      <ReportsClient householdId={household.id} />
    </V2PageShell>
  );
}
