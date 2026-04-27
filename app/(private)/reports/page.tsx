import { PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/server/auth/current-user";
import { getReportsWorkspace } from "@/server/services/workspace";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const { userProfile } = await getCurrentUser();
  const { household } = await getReportsWorkspace(userProfile.id);

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Evolución mensual de ingresos, gastos y ahorro. Identificá tendencias y tomá mejores decisiones."
      />
      <ReportsClient householdId={household.id} />
    </>
  );
}
