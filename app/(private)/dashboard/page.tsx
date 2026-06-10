import { V2PageShell } from "@/components/layout/v2-page-shell";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPrimaryHousehold } from "@/server/services/workspace";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const { userProfile } = await getCurrentUser();
  const household = await getPrimaryHousehold(userProfile.id);

  return (
    <V2PageShell
      eyebrow="Financial Operating System"
      title="Tu mes en perspectiva"
      description="Señales importantes, presión financiera y lo que viene."
    >
      <DashboardClient householdId={household.id} />
    </V2PageShell>
  );
}
