import { PageHeader } from "@/components/app/page-header";
import { DashboardClient } from "./dashboard-client";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Vista ejecutiva de tu salud financiera mensual con transacciones reales."
      />
      <DashboardClient />
    </>
  );
}
