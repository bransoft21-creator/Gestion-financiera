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
  { href: "/dashboard",     label: "Dashboard",      icon: Gauge },
  { href: "/transactions",  label: "Transacciones",  icon: CircleDollarSign },
  { href: "/accounts",      label: "Cuentas",        icon: Landmark },
  { href: "/categories",    label: "Categorías",     icon: FolderTree },
  { href: "/budgets",       label: "Presupuestos",   icon: BarChart3 },
  { href: "/goals",         label: "Metas",          icon: Sparkles },
  { href: "/debts",         label: "Deudas",         icon: CreditCard },
  { href: "/recurring",     label: "Gastos fijos",   icon: RefreshCw },
  { href: "/reports",       label: "Reportes",       icon: TrendingUp },
] as const;

export const investmentsNavItem = {
  label: "Inversiones",
  icon: TrendingUp,
  soon: true,
} as const;
