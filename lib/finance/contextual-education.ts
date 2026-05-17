import type { Signal } from "./financial-signals";
import type { MonthlySignal } from "./monthly-signals";

export type EducationSurface = "dashboard" | "weekly-pulse" | "monthly-close";

export type EducationCategory =
  | "latam-inflation"
  | "invisible-spend"
  | "financial-margin"
  | "credit-load"
  | "installments"
  | "monthly-stability"
  | "strong-currency-savings"
  | "household-balance"
  | "fixed-costs"
  | "cash-wallets";

export type EducationTone = "neutral" | "positive" | "warning";

export type EducationItem = {
  id: string;
  surface: EducationSurface;
  category: EducationCategory;
  tone: EducationTone;
  title: string;
  body: string;
  takeaway: string;
  trigger: string;
  priority: number;
  expiresInDays: number;
};

export type DashboardEducationMetrics = {
  income: number;
  expenses: number;
  savingsRate: number;
  upcomingDebtPayments: number;
  upcomingObligations: number;
  realAvailable: number;
  totalOutstandingDebt: number;
  fixedToIncomeRatio: number;
  accountBalances: Array<{
    currency: "ARS" | "USD" | string;
    amount: number;
  }>;
  expensesByType: {
    variable: number;
  };
  projection: {
    confidence: "high" | "medium" | "low";
  };
};

const EDUCATION_LIBRARY: Record<string, Omit<EducationItem, "surface" | "trigger">> = {
  "financial-margin": {
    id: "financial-margin",
    category: "financial-margin",
    tone: "neutral",
    title: "Margen financiero",
    body: "Es la plata que queda después de cubrir gastos y compromisos. Mirarlo ayuda más que mirar solo el saldo.",
    takeaway: "Un margen chico no es una falla: es una señal para decidir con más contexto.",
    priority: 92,
    expiresInDays: 21,
  },
  "fixed-costs": {
    id: "fixed-costs",
    category: "fixed-costs",
    tone: "neutral",
    title: "Carga fija mensual",
    body: "Los gastos fijos dan previsibilidad, pero también ocupan margen antes de que empiece el mes.",
    takeaway: "Separarlos del gasto variable hace más claro cuánto espacio real queda.",
    priority: 86,
    expiresInDays: 30,
  },
  "credit-load": {
    id: "credit-load",
    category: "credit-load",
    tone: "neutral",
    title: "Uso de crédito",
    body: "La tarjeta puede ordenar pagos, pero concentra compromisos en el próximo cierre.",
    takeaway: "Mirar el cierre futuro ayuda a evitar sorpresas sin convertir cada compra en una alarma.",
    priority: 84,
    expiresInDays: 30,
  },
  installments: {
    id: "installments",
    category: "installments",
    tone: "neutral",
    title: "Cuotas",
    body: "Una cuota chica ocupa margen de meses futuros. Es útil verla como compromiso, no solo como gasto de hoy.",
    takeaway: "El punto no es evitar cuotas: es saber cuánto espacio del mes que viene ya está tomado.",
    priority: 78,
    expiresInDays: 30,
  },
  "invisible-spend": {
    id: "invisible-spend",
    category: "invisible-spend",
    tone: "neutral",
    title: "Gastos invisibles",
    body: "Algunos gastos parecen chicos aislados, pero se vuelven relevantes cuando se repiten en pocos días.",
    takeaway: "Agruparlos por categoría ayuda a entender el patrón sin juzgar cada movimiento.",
    priority: 74,
    expiresInDays: 14,
  },
  "monthly-stability": {
    id: "monthly-stability",
    category: "monthly-stability",
    tone: "positive",
    title: "Estabilidad mensual",
    body: "Cuando el ritmo del mes se mantiene parejo, es más fácil anticipar el cierre y ajustar con tiempo.",
    takeaway: "La estabilidad no significa gastar poco: significa que el mes se vuelve más legible.",
    priority: 64,
    expiresInDays: 21,
  },
  "latam-inflation": {
    id: "latam-inflation",
    category: "latam-inflation",
    tone: "neutral",
    title: "Estabilidad de valor",
    body: "En contextos de inflación, no toda plata quieta conserva el mismo poder de compra.",
    takeaway: "Separar saldos por moneda ayuda a entender qué dinero está disponible y cuál necesita más contexto.",
    priority: 58,
    expiresInDays: 45,
  },
};

function buildItem(
  key: keyof typeof EDUCATION_LIBRARY,
  surface: EducationSurface,
  trigger: string,
  priorityBoost = 0,
): EducationItem {
  const base = EDUCATION_LIBRARY[key];
  return {
    ...base,
    surface,
    trigger,
    priority: base.priority + priorityBoost,
  };
}

export function pickPrimaryEducation(items: EducationItem[]): EducationItem | null {
  if (items.length === 0) return null;
  return [...items].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0] ?? null;
}

export function getDashboardEducation(metrics: DashboardEducationMetrics): EducationItem | null {
  const items: EducationItem[] = [];
  const income = Math.max(metrics.income, 0);
  const hasIncome = income > 0;

  if (hasIncome) {
    const availableRate = metrics.realAvailable / income;
    const obligationsRate = metrics.upcomingObligations / income;
    const fixedRate = metrics.fixedToIncomeRatio / 100;

    if (metrics.realAvailable < 0 || availableRate < 0.06) {
      items.push(buildItem("financial-margin", "dashboard", "low_real_available", metrics.realAvailable < 0 ? 8 : 0));
    }

    if (obligationsRate >= 0.35 || fixedRate >= 0.55) {
      items.push(buildItem("fixed-costs", "dashboard", "high_fixed_or_obligations", obligationsRate >= 0.45 ? 6 : 0));
    }
  }

  if (metrics.totalOutstandingDebt > 0 || metrics.upcomingDebtPayments > 0) {
    items.push(buildItem("credit-load", "dashboard", "debt_or_card_commitments"));
  }

  const variableShare = metrics.expenses > 0 ? metrics.expensesByType.variable / metrics.expenses : 0;
  if (metrics.expenses > 0 && variableShare >= 0.55) {
    items.push(buildItem("invisible-spend", "dashboard", "variable_spend_share"));
  }

  const hasArs = metrics.accountBalances.some((balance) => balance.currency === "ARS" && balance.amount > 0);
  const hasUsd = metrics.accountBalances.some((balance) => balance.currency === "USD" && balance.amount > 0);
  if (hasArs && hasUsd) {
    items.push(buildItem("latam-inflation", "dashboard", "multi_currency_balances"));
  }

  if (hasIncome && metrics.savingsRate >= 15 && metrics.projection.confidence !== "low") {
    items.push(buildItem("monthly-stability", "dashboard", "stable_positive_margin"));
  }

  return pickPrimaryEducation(items);
}

export function getWeeklyPulseEducation(signals: Signal[]): EducationItem | null {
  const ids = new Set(signals.map((signal) => signal.id));
  const items: EducationItem[] = [];

  if (ids.has("CREDIT_HEAVY")) {
    items.push(buildItem("credit-load", "weekly-pulse", "weekly_credit_heavy", 6));
  }

  if (ids.has("DELIVERY_HIGH") || ids.has("CATEGORY_DOMINANT") || ids.has("WEEKEND_SPIKE")) {
    items.push(buildItem("invisible-spend", "weekly-pulse", "weekly_concentration"));
  }

  if (ids.has("LOW_SAVINGS")) {
    items.push(buildItem("financial-margin", "weekly-pulse", "weekly_intense_flow"));
  }

  if (ids.has("STABLE_WEEK") || ids.has("EXPENSES_DOWN") || ids.has("GOOD_SAVINGS")) {
    items.push(buildItem("monthly-stability", "weekly-pulse", "weekly_stable_flow"));
  }

  return pickPrimaryEducation(items);
}

export function getMonthlyCloseEducation(signals: MonthlySignal[]): EducationItem | null {
  const ids = new Set(signals.map((signal) => signal.id));
  const items: EducationItem[] = [];

  if (ids.has("NEGATIVE_AVAILABLE") || ids.has("TIGHT_MARGIN")) {
    items.push(buildItem("financial-margin", "monthly-close", "monthly_margin_signal", ids.has("NEGATIVE_AVAILABLE") ? 8 : 0));
  }

  if (ids.has("OBLIGATIONS_HIGH")) {
    items.push(buildItem("fixed-costs", "monthly-close", "monthly_obligations_high", 6));
  }

  if (ids.has("STABLE_MONTH") || ids.has("GOOD_AVAILABLE") || ids.has("MARGIN_BETTER")) {
    items.push(buildItem("monthly-stability", "monthly-close", "monthly_stable_or_better"));
  }

  if (ids.has("EXPENSES_UP")) {
    items.push(buildItem("invisible-spend", "monthly-close", "monthly_expenses_up"));
  }

  return pickPrimaryEducation(items);
}
