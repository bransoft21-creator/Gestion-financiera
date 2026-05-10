import { getTransactionWorkspace } from "@/server/services/workspace";
import { getCurrentUser } from "@/server/auth/current-user";
import { SmartImportClient } from "./smart-import-client";

export const metadata = { title: "Smart Import" };

export default async function SmartImportPage() {
  const { userProfile } = await getCurrentUser();
  const { household, accounts, categories } = await getTransactionWorkspace(userProfile.id);

  return (
    <SmartImportClient
      householdId={household.id}
      accounts={accounts}
      categories={categories}
    />
  );
}
