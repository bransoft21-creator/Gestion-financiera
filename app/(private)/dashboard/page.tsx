import { V2PageShell } from "@/components/layout/v2-page-shell";
import { DashboardClient } from "./dashboard-client";

export default function DashboardPage() {
  return (
    <V2PageShell
      eyebrow="Financial Operating System"
      title="Qué deberías saber hoy"
      description="Una lectura clara de tu mes: señales importantes, presión financiera y próximos movimientos."
    >
      <DashboardClient />
    </V2PageShell>
  );
}
