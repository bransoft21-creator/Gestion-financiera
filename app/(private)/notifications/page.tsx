import { ActivityCenter } from "@/components/app/activity-center";
import { V2PageShell } from "@/components/layout/v2-page-shell";

export default function NotificationsPage() {
  return (
    <V2PageShell
      eyebrow="Financial Activity Center"
      title="Actividad financiera"
      description="Señales, insights y recordatorios en un feed calmo para revisar tu dinero sin ruido."
    >
      <div className="mx-auto w-full max-w-3xl">
        <ActivityCenter />
      </div>
    </V2PageShell>
  );
}
