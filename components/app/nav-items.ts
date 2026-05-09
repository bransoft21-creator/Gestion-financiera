import {
  BarChart3,
  CircleDollarSign,
  CreditCard,
  FolderTree,
  Gauge,
  Landmark,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";

export const navItems = [
  { href: "/dashboard",     label: "Hoy",            icon: Gauge },
  { href: "/transactions",  label: "Movimientos",    icon: CircleDollarSign },
  { href: "/accounts",      label: "Cuentas",        icon: Landmark },
  { href: "/categories",    label: "Categorías",     icon: FolderTree },
  { href: "/budgets",       label: "Plan",           icon: BarChart3 },
  { href: "/goals",         label: "Futuro",         icon: Sparkles },
  { href: "/debts",         label: "Deudas",         icon: CreditCard },
  { href: "/recurring",     label: "Compromisos",    icon: RefreshCw },
  { href: "/reports",       label: "Patrones",       icon: TrendingUp },
] as const;

export const investmentsNavItem = {
  label: "Inversiones",
  icon: TrendingUp,
  soon: true,
} as const;
