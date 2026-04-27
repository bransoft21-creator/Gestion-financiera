import { Landmark, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/server/auth/current-user";
import { getAccountWorkspace } from "@/server/services/workspace";
import { AccountsClient } from "./accounts-client";

export default async function AccountsPage() {
  const { userProfile } = await getCurrentUser();
  const { household } = await getAccountWorkspace(userProfile.id);

  return (
    <>
      <PageHeader
        title="Cuentas"
        description="Administrá tus cuentas bancarias, efectivo, tarjetas y billeteras digitales. El patrimonio neto se calcula en tiempo real."
      />
      <AccountsClient householdId={household.id} />
    </>
  );
}
