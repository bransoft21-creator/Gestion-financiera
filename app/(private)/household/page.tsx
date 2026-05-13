import { V2PageShell } from "@/components/layout/v2-page-shell";
import { getCurrentUser } from "@/server/auth/current-user";
import { listHouseholds } from "@/server/services/households";
import { HouseholdClient } from "./household-client";

export default async function HouseholdPage() {
  const { userProfile } = await getCurrentUser();
  const households = await listHouseholds(userProfile.id);

  return (
    <V2PageShell
      eyebrow="Meridian Household"
      title="Hogar"
      description="Un espacio compartido para organizar gastos sin convertir la vida en una planilla."
    >
      <HouseholdClient initialHouseholds={households} />
    </V2PageShell>
  );
}
