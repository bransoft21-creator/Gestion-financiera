import { V2PageShell } from "@/components/layout/v2-page-shell";
import { getCurrentUser } from "@/server/auth/current-user";
import { getAgreementsWorkspace } from "@/server/services/workspace";
import { AgreementsClient } from "./agreements-client";

export default async function AgreementsPage() {
  const { userProfile } = await getCurrentUser();
  const { household, accounts } = await getAgreementsWorkspace(userProfile.id);

  return (
    <V2PageShell
      eyebrow="Dinero en tránsito"
      title="Entre personas"
      description="Dinero que circula con otras personas: lo que te deben, lo que debés y lo que compartieron."
    >
      <AgreementsClient
        householdId={household.id}
        accounts={accounts}
        defaultCurrency={userProfile.currency as "ARS" | "USD"}
      />
    </V2PageShell>
  );
}
