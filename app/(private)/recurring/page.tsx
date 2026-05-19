import { V2PageShell } from "@/components/layout/v2-page-shell";
import { getCurrentUser } from "@/server/auth/current-user";
import { getRecurringExpenseWorkspace } from "@/server/services/workspace";
import { RecurringExpensesClient } from "./recurring-expenses-client";

export default async function RecurringPage() {
  const { userProfile } = await getCurrentUser();
  const { household, accounts, categories } = await getRecurringExpenseWorkspace(userProfile.id);

  return (
    <V2PageShell
      eyebrow="Gastos fijos invisibles"
      title="El dinero que se va solo"
      description="Compromisos mensuales fijos: suscripciones, servicios y pagos automáticos."
    >
      <RecurringExpensesClient
        householdId={household.id}
        accounts={accounts}
        categories={categories}
        defaultCurrency={userProfile.currency as "ARS" | "USD"}
      />
    </V2PageShell>
  );
}
