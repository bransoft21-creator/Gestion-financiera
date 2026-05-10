import {
  BarChart3,
  Bell,
  CircleDollarSign,
  CreditCard,
  FolderTree,
  Gauge,
  Landmark,
  RefreshCw,
  ScanLine,
  Sparkles,
  TrendingUp,
} from "lucide-react";

export const navItems = [
  { href: "/dashboard",     label: "Hoy",            icon: Gauge },
  { href: "/transactions",  label: "Movimientos",    icon: CircleDollarSign },
  { href: "/smart-import",  label: "Smart Import",   icon: ScanLine },
  { href: "/accounts",      label: "Dinero",         icon: Landmark },
  { href: "/categories",    label: "Lenguaje",       icon: FolderTree },
  { href: "/budgets",       label: "Plan",           icon: BarChart3 },
  { href: "/goals",         label: "Futuro",         icon: Sparkles },
  { href: "/debts",         label: "Presión",        icon: CreditCard },
  { href: "/recurring",     label: "Compromisos",    icon: RefreshCw },
  { href: "/notifications", label: "Avisos",         icon: Bell },
  { href: "/reports",       label: "Patrones",       icon: TrendingUp },
] as const;

export const investmentsNavItem = {
  label: "Inversiones",
  icon: TrendingUp,
  soon: true,
} as const;
