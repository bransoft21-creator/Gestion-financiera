import { V2PageShell } from "@/components/layout/v2-page-shell";
import { getCurrentUser } from "@/server/auth/current-user";
import { getAccountWorkspace } from "@/server/services/workspace";
import { AccountsClient } from "./accounts-client";

export default async function AccountsPage() {
  const { userProfile } = await getCurrentUser();
  const { household } = await getAccountWorkspace(userProfile.id);

  return (
    <V2PageShell
      eyebrow="Dónde vive tu dinero"
      title="Tus cuentas, ordenadas por claridad"
      description="Bancos, efectivo, tarjetas y billeteras como lugares financieros, no como registros administrativos."
    >
      <AccountsClient householdId={household.id} />
    </V2PageShell>
  );
}
