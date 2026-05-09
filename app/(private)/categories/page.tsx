import { V2PageShell } from "@/components/layout/v2-page-shell";
import { getCurrentUser } from "@/server/auth/current-user";
import { getCategoryWorkspace } from "@/server/services/workspace";
import { CategoriesClient } from "./categories-client";

export default async function CategoriesPage() {
  const { userProfile } = await getCurrentUser();
  const workspace = await getCategoryWorkspace(userProfile.id);

  return (
    <V2PageShell
      eyebrow="Lenguaje financiero"
      title="Cómo tu app entiende tus movimientos"
      description="Categorías personales para que cada gasto, ingreso y compromiso tenga contexto real."
    >
      <CategoriesClient householdId={workspace.household.id} initialCategories={workspace.categories} />
    </V2PageShell>
  );
}
