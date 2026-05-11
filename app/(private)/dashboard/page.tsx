import { V2PageShell } from "@/components/layout/v2-page-shell";
import { DashboardClient } from "./dashboard-client";

export default function DashboardPage() {
  return (
    <V2PageShell
      eyebrow="Financial Operating System"
      title="Tu mes en perspectiva"
      description="Señales importantes, presión financiera y lo que viene."
    >
      <DashboardClient />
    </V2PageShell>
  );
}
