import { NotificationsButton } from "@/components/app/notifications-button";
import { V2PageShell } from "@/components/layout/v2-page-shell";

export default function NotificationsPage() {
  return (
    <V2PageShell
      eyebrow="Centro de avisos"
      title="Señales que merecen tu atención"
      description="Configurá qué eventos financieros te interrumpen y revisá el estado del canal de avisos sin depender de un panel flotante."
    >
      <div className="mx-auto w-full max-w-3xl">
        <NotificationsButton embedded />
      </div>
    </V2PageShell>
  );
}
