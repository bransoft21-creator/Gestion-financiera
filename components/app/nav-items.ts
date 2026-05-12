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
  User,
} from "lucide-react";

export const navItems = [
  { href: "/dashboard",     label: "Hoy",              icon: Gauge },
  { href: "/transactions",  label: "Movimientos",      icon: CircleDollarSign },
  { href: "/smart-import",  label: "Smart Import",     icon: ScanLine },
  { href: "/accounts",      label: "Dinero",           icon: Landmark },
  { href: "/categories",    label: "Categorías",       icon: FolderTree },
  { href: "/budgets",       label: "Presupuesto",      icon: BarChart3 },
  { href: "/goals",         label: "Metas",            icon: Sparkles },
  { href: "/debts",         label: "Deudas",           icon: CreditCard },
  { href: "/recurring",     label: "Recurrentes",      icon: RefreshCw },
  { href: "/notifications", label: "Actividad",        icon: Bell },
  { href: "/reports",       label: "Patrones",         icon: TrendingUp },
  { href: "/profile",       label: "Mi perfil",        icon: User },
] as const;

export const investmentsNavItem = {
  label: "Inversiones",
  icon: TrendingUp,
  soon: true,
} as const;
