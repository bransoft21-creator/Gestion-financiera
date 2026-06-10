import {
  BarChart3,
  BotMessageSquare,
  CircleDollarSign,
  CalendarCheck2,
  FileUp,
  Gauge,
  HandCoins,
  Home,
  Landmark,
  Settings,
  Target,
  TrendingUp,
} from "lucide-react";
import type { AwarenessTarget } from "@/lib/navigation-awareness";

export const navItems = [
  {
    href: "/dashboard",
    label: "Balance",
    shortLabel: "Balance",
    icon: Gauge,
    tier: "core",
    mobile: "primary",
  },
  {
    href: "/transactions",
    label: "Movimientos",
    shortLabel: "Movs.",
    icon: CircleDollarSign,
    tier: "core",
    mobile: "primary",
  },
  {
    href: "/copilot",
    label: "Copilot",
    shortLabel: "Copilot",
    icon: BotMessageSquare,
    tier: "core",
    featured: true,
  },
  {
    href: "/household",
    label: "Hogar",
    shortLabel: "Hogar",
    icon: Home,
    tier: "core",
    mobile: "primary",
    awarenessTarget: "household",
  },
  {
    href: "/budgets",
    label: "Presupuesto",
    shortLabel: "Plan",
    icon: BarChart3,
    tier: "weekly",
    awarenessTarget: "budgets",
  },
  {
    href: "/commitments",
    label: "Compromisos",
    shortLabel: "Compromisos",
    icon: CalendarCheck2,
    tier: "weekly",
    awarenessTarget: "recurring",
  },
  {
    href: "/agreements",
    label: "Préstamos",
    shortLabel: "Préstamos",
    icon: HandCoins,
    tier: "weekly",
    awarenessTarget: "agreements",
  },
  {
    href: "/accounts",
    label: "Cuentas",
    shortLabel: "Cuentas",
    icon: Landmark,
    tier: "advanced",
  },
  {
    href: "/goals",
    label: "Metas",
    shortLabel: "Metas",
    icon: Target,
    tier: "advanced",
  },
  {
    href: "/smart-import",
    label: "Smart Import",
    shortLabel: "Import",
    icon: FileUp,
    tier: "advanced",
    mobile: "primary",
  },
  {
    href: "/settings",
    label: "Ajustes",
    shortLabel: "Ajustes",
    icon: Settings,
    tier: "advanced",
  },
] satisfies Array<{
  href: string;
  label: string;
  shortLabel: string;
  icon: typeof Gauge;
  tier: "core" | "weekly" | "advanced";
  mobile?: "primary";
  awarenessTarget?: AwarenessTarget;
  featured?: boolean;
}>;

export const investmentsNavItem = {
  label: "Inversiones",
  icon: TrendingUp,
  soon: true,
} as const;
