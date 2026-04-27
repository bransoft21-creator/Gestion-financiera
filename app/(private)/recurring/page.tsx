import { PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/server/auth/current-user";
import { getRecurringExpenseWorkspace } from "@/server/services/workspace";
import { RecurringExpensesClient } from "./recurring-expenses-client";

export default async function RecurringPage() {
  const { userProfile } = await getCurrentUser();
  const { household, accounts, categories } = await getRecurringExpenseWorkspace(userProfile.id);

  return (
    <>
      <PageHeader
        title="Gastos Recurrentes"
        description="Suscripciones, alquiler, servicios y cualquier gasto que se repite. Mantené el control de los vencimientos próximos."
      />
      <RecurringExpensesClient
        householdId={household.id}
        accounts={accounts}
        categories={categories}
      />
    </>
  );
}
