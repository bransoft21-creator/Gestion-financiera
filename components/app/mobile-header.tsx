"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";
import { NotificationsButton } from "./notifications-button";
import { PrivacyToggle } from "./privacy-toggle";

const SECTION_LABELS: Record<string, string> = {
  "/dashboard": "Tu panorama del día",
  "/transactions": "Movimientos",
  "/smart-import": "Importar",
  "/household": "Hogar compartido",
  "/activity": "Actividad",
  "/budgets": "Plan del mes",
  "/recurring": "Gastos recurrentes",
  "/debts": "Deudas",
  "/categories": "Categorías",
  "/accounts": "Cuentas",
  "/goals": "Metas",
  "/data-quality": "Calidad de datos",
  "/reports": "Reportes",
  "/profile": "Tu perfil",
  "/settings": "Configuración",
};

type MobileHeaderProps = {
  userName?: string | null;
};

export function MobileHeader({ userName }: MobileHeaderProps) {
  const pathname = usePathname();
  const firstName = userName?.split(" ")[0];

  const sectionLabel =
    Object.entries(SECTION_LABELS).find(
      ([path]) => pathname === path || pathname.startsWith(`${path}/`),
    )?.[1] ?? (firstName ? `Hola, ${firstName}` : "Meridian");

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-background px-5 lg:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex h-[72px] items-center justify-between">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3.5">
          <Image src="/icons/Meridian.png" alt="Meridian" width={50} height={50} className="shrink-0 select-none" />
          <span className="min-w-0">
            <span className="block truncate text-[17px] font-semibold leading-snug tracking-tight text-foreground">
              Meridian
            </span>
            <span className="block truncate text-[13px] font-medium leading-snug text-muted-foreground">
              {sectionLabel}
            </span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-0.5">
          <span data-tutorial="privacy-toggle-mobile">
            <PrivacyToggle compact />
          </span>
          <span data-tutorial="notifications-mobile">
            <NotificationsButton compact panelClassName="fixed left-3 right-3 w-auto top-[calc(env(safe-area-inset-top)+4.5rem+8px)]" />
          </span>
          <LogoutButton compact />
        </div>
      </div>
    </header>
  );
}
