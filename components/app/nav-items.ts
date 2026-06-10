import {
  BarChart3,
  BotMessageSquare,
  CircleDollarSign,
  CalendarCheck2,
  CreditCard,
  Gauge,
  HandCoins,
  Home,
  Landmark,
  ScanLine,
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
    href: "/smart-import",
    label: "Smart Import",
    shortLabel: "Import",
    icon: ScanLine,
    tier: "core",
    mobile: "primary",
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
    href: "/copilot",
    label: "Copilot",
    shortLabel: "Copilot",
    icon: BotMessageSquare,
    tier: "core",
    featured: true,
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
    href: "/debts",
    label: "Créditos y cuotas",
    shortLabel: "Créditos",
    icon: CreditCard,
    tier: "weekly",
    awarenessTarget: "debts",
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
