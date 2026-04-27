import { PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/server/auth/current-user";
import { getCategoryWorkspace } from "@/server/services/workspace";
import { CategoriesClient } from "./categories-client";

export default async function CategoriesPage() {
  const { userProfile } = await getCurrentUser();
  const workspace = await getCategoryWorkspace(userProfile.id);

  return (
    <>
      <PageHeader
        title="Categorías"
        description="Organización de ingresos, gastos, ahorro, deuda e inversión futura."
      />
      <CategoriesClient householdId={workspace.household.id} initialCategories={workspace.categories} />
    </>
  );
}
