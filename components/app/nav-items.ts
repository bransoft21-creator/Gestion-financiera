import {
  BarChart3,
  Bell,
  CircleDollarSign,
  CreditCard,
  FolderTree,
  Gauge,
  HandCoins,
  Home,
  Landmark,
  ListChecks,
  RefreshCw,
  ScanLine,
  Settings,
  Sparkles,
  TrendingUp,
  User,
} from "lucide-react";
import type { AwarenessTarget } from "@/lib/navigation-awareness";

export const navItems = [
  {
    href: "/dashboard",
    label: "Hoy",
    shortLabel: "Hoy",
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
    awarenessTarget: "smart-import",
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
    href: "/notifications",
    label: "Actividad",
    shortLabel: "Actividad",
    icon: Bell,
    tier: "core",
    awarenessTarget: "activity",
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
    href: "/recurring",
    label: "Recurrentes",
    shortLabel: "Recurrentes",
    icon: RefreshCw,
    tier: "weekly",
    awarenessTarget: "recurring",
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
    href: "/agreements",
    label: "Dinero en tránsito",
    shortLabel: "Tránsito",
    icon: HandCoins,
    tier: "weekly",
    awarenessTarget: "agreements",
  },
  {
    href: "/categories",
    label: "Categorías",
    shortLabel: "Categorías",
    icon: FolderTree,
    tier: "weekly",
  },
  {
    href: "/accounts",
    label: "Dinero",
    shortLabel: "Dinero",
    icon: Landmark,
    tier: "advanced",
  },
  {
    href: "/goals",
    label: "Metas",
    shortLabel: "Metas",
    icon: Sparkles,
    tier: "advanced",
  },
  {
    href: "/settings/data-quality",
    label: "Data Quality",
    shortLabel: "Calidad",
    icon: ListChecks,
    tier: "advanced",
    awarenessTarget: "data-quality",
  },
  {
    href: "/reports",
    label: "Patrones",
    shortLabel: "Patrones",
    icon: TrendingUp,
    tier: "advanced",
  },
  {
    href: "/profile",
    label: "Mi perfil",
    shortLabel: "Perfil",
    icon: User,
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
