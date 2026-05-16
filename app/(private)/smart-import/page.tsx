import { ShieldAlert } from "lucide-react";
import { getTransactionWorkspace } from "@/server/services/workspace";
import { getCurrentUser } from "@/server/auth/current-user";
import { V2PageShell } from "@/components/layout/v2-page-shell";
import { isSmartImportEnabled } from "@/lib/feature-flags";
import { SmartImportClient } from "./smart-import-client";

export const metadata = { title: "Smart Import" };

export default async function SmartImportPage() {
  const { userProfile } = await getCurrentUser();

  if (!isSmartImportEnabled(userProfile.email)) {
    return (
      <V2PageShell eyebrow="IA" title="Smart Import">
        <div className="overflow-hidden rounded-[24px] border border-border bg-card/60 p-5 sm:p-7">
          <div className="max-w-2xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="text-balance text-3xl font-semibold leading-tight text-foreground">
              La IA todavía no está habilitada.
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Contactate con el administrador para activar Smart Import.
            </p>
          </div>
        </div>
      </V2PageShell>
    );
  }

  const { household, accounts, categories } = await getTransactionWorkspace(userProfile.id);

  return (
    <SmartImportClient
      householdId={household.id}
      accounts={accounts}
      categories={categories}
    />
  );
}
