import { getCurrentUser } from "@/server/auth/current-user";
import { getTransactionWorkspace } from "@/server/services/workspace";
import {
  getQualitySignals,
  getUncategorizedTransactions,
  getFrequentUncategorizedDescriptions,
  getSimilarCategories,
  getUnusedCategories,
} from "@/server/services/data-quality";
import { V2PageShell } from "@/components/layout/v2-page-shell";
import { DataQualityClient } from "./data-quality-client";

export const metadata = { title: "Revisar movimientos — Meridian" };

export default async function DataQualityPage() {
  const { userProfile } = await getCurrentUser();
  const { household, categories } = await getTransactionWorkspace(userProfile.id);

  const [signals, uncategorized, frequent, similar, unused] = await Promise.all([
    getQualitySignals(userProfile.id, household.id),
    getUncategorizedTransactions(userProfile.id, household.id),
    getFrequentUncategorizedDescriptions(userProfile.id, household.id),
    getSimilarCategories(userProfile.id, household.id),
    getUnusedCategories(userProfile.id, household.id),
  ]);

  return (
    <V2PageShell
      eyebrow="Organización"
      title="Revisar movimientos"
      description="Detectá movimientos sin categoría, categorías duplicadas y datos que afectan tus reportes."
    >
      <DataQualityClient
        householdId={household.id}
        initialSignals={signals}
        initialUncategorized={uncategorized}
        initialFrequent={frequent}
        initialSimilar={similar}
        initialUnused={unused}
        categories={categories}
      />
    </V2PageShell>
  );
}
