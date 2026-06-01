import type {
  DashboardSummary,
  HealthSignal,
  InsightCardTone,
  InsightSignalTone,
  TimeContext,
  TimeOfDay,
} from "./types";

export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function formatMoney(value: number, currency: "ARS" | "USD" | string = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export const easeOut = [0.16, 1, 0.3, 1] as const;

export const sectionReveal = {
  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: easeOut },
  },
};

export function getTimeContext(firstName?: string | null): TimeContext {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const name = firstName ? `, ${firstName}` : "";

  let timeOfDay: TimeOfDay;
  let greeting: string;

  if (hour >= 6 && hour < 13) {
    timeOfDay = "morning";
    greeting = `Buen día${name}.`;
  } else if (hour >= 13 && hour < 20) {
    timeOfDay = "afternoon";
    greeting = `Buenas tardes${name}.`;
  } else if (hour >= 20 && hour < 23) {
    timeOfDay = "evening";
    greeting = `Buenas noches${name}.`;
  } else {
    timeOfDay = "night";
    greeting = "Todo en calma.";
  }

  return { greeting, timeOfDay, isWeekend };
}

export function getAmbientHint(
  metrics: DashboardSummary["metrics"],
  timeCtx: TimeContext,
  isCurrentMonth: boolean,
): string | null {
  if (metrics.income === 0 && metrics.expenses === 0) {
    return isCurrentMonth ? "Este mes todavía está en blanco. Todo empieza desde acá." : null;
  }

  const { savingsRate, fixedToIncomeRatio, upcomingObligations, projection } = metrics;

  if (isCurrentMonth) {
    if (projection.daysRemaining <= 3) return "El mes está cerrando. Un último vistazo.";
    if (projection.daysRemaining <= 7) return "El mes está en su tramo final.";
    if (timeCtx.isWeekend && timeCtx.timeOfDay === "morning") {
      return "Los fines de semana suelen mover más los gastos. Buen momento para revisar.";
    }
    if (timeCtx.timeOfDay === "morning" && savingsRate >= 15) return "Tu situación viene estable. Buen arranque.";
    if (timeCtx.timeOfDay === "night") return "Todo lo que importa hoy está resumido acá.";
  }

  if (savingsRate >= 25) return `Guardás el ${savingsRate}% del ingreso este mes. Viene sólido.`;
  if (savingsRate >= 15) return `El ${savingsRate}% va al ahorro. Ritmo positivo.`;
  if (upcomingObligations === 0 && savingsRate >= 0) return "Sin compromisos pendientes. El mes puede cerrar limpio.";
  if (fixedToIncomeRatio < 35 && metrics.income > 0) return "Los gastos fijos están tranquilos este mes.";
  if (fixedToIncomeRatio >= 55 && metrics.income > 0) return "Los fijos están pesando. Vale revisarlos antes de fin de mes.";
  if (savingsRate < 0) return "El disponible real es negativo. El mes pide atención.";

  return "Todo lo que importa está resumido acá.";
}

export function buildHealthSignals(metrics: DashboardSummary["metrics"], isCurrentMonth = true): HealthSignal[] {
  const signals: HealthSignal[] = [];
  if (metrics.savingsRate >= 20) {
    signals.push({ label: "Ahorro saludable", tone: "positive" });
  } else if (metrics.savingsRate >= 10) {
    signals.push({ label: "Ahorro activo", tone: "positive" });
  } else if (metrics.savingsRate < 0) {
    signals.push({ label: "Mes en déficit", tone: "warning" });
  }
  if (metrics.fixedToIncomeRatio < 35 && metrics.income > 0) {
    signals.push({ label: "Fijos controlados", tone: "positive" });
  } else if (metrics.fixedToIncomeRatio >= 55 && metrics.income > 0) {
    signals.push({ label: "Carga fija alta", tone: "warning" });
  } else if (metrics.fixedToIncomeRatio >= 40 && metrics.income > 0) {
    signals.push({ label: "Fijos en zona media", tone: "warning" });
  }
  if (metrics.upcomingObligations === 0 && metrics.income > 0) {
    signals.push({ label: "Sin presión pendiente", tone: "positive" });
  }
  if (isCurrentMonth && metrics.projection.projectedExpenses > metrics.income * 1.05 && metrics.income > 0) {
    signals.push({ label: "Proyección supera ingresos", tone: "warning" });
  }
  return signals;
}

type InsightResult = {
  insight: string;
  insightTone: InsightSignalTone;
  cardTone: InsightCardTone;
};

export function getIncomeInsight(metrics: DashboardSummary["metrics"]): InsightResult {
  if (metrics.savingsRate >= 20) {
    return {
      insight: `Tasa de ahorro del ${metrics.savingsRate}%. Vas por buen camino.`,
      insightTone: "positive",
      cardTone: "positive",
    };
  }
  if (metrics.savingsRate >= 5) {
    return {
      insight: `El ${metrics.savingsRate}% va al ahorro. Hay margen para crecer.`,
      insightTone: "neutral",
      cardTone: "neutral",
    };
  }
  if (metrics.savingsRate < 0) {
    return {
      insight: "Gastás más de lo que entra. El mes necesita ajuste.",
      insightTone: "warning",
      cardTone: "danger",
    };
  }
  return {
    insight: "Base del mes. Todo lo demás se mide desde este número.",
    insightTone: "neutral",
    cardTone: "neutral",
  };
}

export function getExpensesInsight(metrics: DashboardSummary["metrics"]): InsightResult {
  if (metrics.spendingRate === 0) {
    return { insight: "El mes todavía está en blanco.", insightTone: "neutral", cardTone: "neutral" };
  }
  if (metrics.spendingRate >= 100) {
    return {
      insight: `${metrics.spendingRate}% del ingreso consumido. Superaste el límite del mes.`,
      insightTone: "warning",
      cardTone: "danger",
    };
  }
  if (metrics.spendingRate >= 85) {
    return {
      insight: `${metrics.spendingRate}% gastado. Margen muy ajustado para lo que queda.`,
      insightTone: "warning",
      cardTone: "warning",
    };
  }
  if (metrics.spendingRate >= 65) {
    return {
      insight: `${metrics.spendingRate}% del ingreso en movimiento. Ritmo activo.`,
      insightTone: "neutral",
      cardTone: "neutral",
    };
  }
  return {
    insight: `Vas con margen. El ${metrics.spendingRate}% del ingreso en movimiento.`,
    insightTone: "positive",
    cardTone: "neutral",
  };
}

export function getReservedInsight(metrics: DashboardSummary["metrics"]): InsightResult {
  if (metrics.remainingReservedBudget === 0) {
    return {
      insight: "Sin presupuesto pendiente. Tus categorías están al día.",
      insightTone: "positive",
      cardTone: "positive",
    };
  }
  const reservedRatio = metrics.income > 0
    ? Math.round((metrics.remainingReservedBudget / metrics.income) * 100)
    : 0;
  if (reservedRatio >= 30) {
    return {
      insight: `El ${reservedRatio}% del ingreso está bloqueado en presupuestos activos.`,
      insightTone: "warning",
      cardTone: "warning",
    };
  }
  return {
    insight: "Dinero comprometido para categorías con presupuesto activo.",
    insightTone: "neutral",
    cardTone: "neutral",
  };
}

export function getObligationsInsight(metrics: DashboardSummary["metrics"]): InsightResult {
  if (metrics.upcomingObligations === 0) {
    return {
      insight: "Sin compromisos pendientes. El mes puede cerrar limpio.",
      insightTone: "positive",
      cardTone: "positive",
    };
  }
  if (metrics.realAvailable < 0) {
    return {
      insight: "El disponible real ya es negativo antes de cubrir los compromisos.",
      insightTone: "warning",
      cardTone: "danger",
    };
  }
  if (metrics.upcomingObligations > metrics.realAvailable * 0.5) {
    return {
      insight: "Los compromisos consumen más de la mitad del disponible real.",
      insightTone: "warning",
      cardTone: "warning",
    };
  }
  return {
    insight: "Compromisos cubiertos por el disponible actual. Sin tensión.",
    insightTone: "neutral",
    cardTone: "neutral",
  };
}

export function getHeroHeadline(metrics: DashboardSummary["metrics"], isCurrentMonth = true): string {
  const { realAvailable, spendingRate, fixedToIncomeRatio, savingsRate } = metrics;

  if (!isCurrentMonth) {
    if (realAvailable < 0) return "El mes cerró en negativo.";
    if (spendingRate > 100) return "Los gastos superaron los ingresos.";
    if (fixedToIncomeRatio > 70) return "Los gastos fijos pesaron fuerte.";
    if (savingsRate >= 20) return "Un mes con ahorro sólido.";
    return "El mes quedó registrado.";
  }

  if (realAvailable < 0) return "Tu mes pide una corrección.";
  if (spendingRate > 100) return "El ritmo actual supera tus ingresos.";
  if (fixedToIncomeRatio > 70) return "Los gastos fijos están pesando fuerte.";
  if (spendingRate > 82 || fixedToIncomeRatio > 58) return "Tu mes viene ajustado, pero manejable.";
  if (savingsRate >= 20) return "Mes sólido. Tu ahorro está presente.";
  return "Tu dinero respira este mes.";
}

export function getHeroPrimarySignal(
  metrics: DashboardSummary["metrics"],
  isCurrentMonth = true,
): { text: string; tone: "positive" | "warning" | "danger" } {
  const { fixedToIncomeRatio, spendingRate, savingsRate, realAvailable, projection } = metrics;

  if (!isCurrentMonth) {
    // CLOSED: retrospective signals, no projections
    if (realAvailable < 0)
      return { text: "El mes cerró con disponible real negativo.", tone: "danger" };
    if (spendingRate > 100)
      return { text: "Los gastos superaron los ingresos registrados.", tone: "danger" };
    if (fixedToIncomeRatio > 70)
      return { text: `Gastos fijos al ${fixedToIncomeRatio}% del ingreso — mes de alta carga.`, tone: "danger" };
    if (savingsRate >= 20)
      return { text: `Tasa de ahorro final: ${savingsRate}% — resultado sólido.`, tone: "positive" };
    if (savingsRate > 8)
      return { text: `Ahorro final del ${savingsRate}% del ingreso.`, tone: "positive" };
    return { text: `${spendingRate}% del ingreso consumido en el mes.`, tone: "positive" };
  }

  // OPEN: forward-looking signals
  if (realAvailable < 0)
    return { text: "Disponible real negativo — el mes necesita corrección.", tone: "danger" };
  if (spendingRate > 100)
    return { text: "El ritmo de gasto supera los ingresos del mes.", tone: "danger" };
  if (fixedToIncomeRatio > 70)
    return { text: `Gastos fijos al ${fixedToIncomeRatio}% del ingreso — por encima del límite.`, tone: "danger" };
  if (fixedToIncomeRatio > 58)
    return { text: `Gastos fijos al ${fixedToIncomeRatio}% — están presionando el mes.`, tone: "warning" };
  if (spendingRate > 82)
    return { text: `${spendingRate}% del ingreso ya consumido a este ritmo.`, tone: "warning" };
  if (projection.isCurrentMonth && projection.projectedRealAvailable < 0)
    return { text: "El cierre estimado queda por debajo de cero si el ritmo no cambia.", tone: "warning" };
  if (savingsRate >= 20)
    return { text: `Tasa de ahorro del ${savingsRate}% — por encima del objetivo.`, tone: "positive" };
  if (savingsRate > 8)
    return { text: `Mes con ahorro presente — margen del ${savingsRate}%.`, tone: "positive" };
  return { text: `${spendingRate}% del ingreso consumido — dentro de lo esperado.`, tone: "positive" };
}

export function buildNarrative(metrics: DashboardSummary["metrics"], isCurrentMonth = true): string {
  if (metrics.income === 0 && metrics.expenses === 0) return "";
  const parts: string[] = [];

  if (!isCurrentMonth) {
    // CLOSED period: definitive past-tense language
    if (metrics.income > 0) {
      parts.push(`Gastaste ${formatMoney(metrics.expenses, metrics.currency)} de ${formatMoney(metrics.income, metrics.currency)}.`);
    }
    if (metrics.realAvailable >= 0) {
      parts.push(`El mes cerró con ${formatMoney(metrics.realAvailable, metrics.currency)} de balance.`);
    } else {
      parts.push("El mes cerró con el disponible real en negativo.");
    }
    return parts.join(" ");
  }

  // OPEN period: present/future language
  if (metrics.income > 0) {
    parts.push(`Vas gastando ${formatMoney(metrics.expenses, metrics.currency)} de ${formatMoney(metrics.income, metrics.currency)}.`);
  }
  if (metrics.realAvailable >= 0) {
    const suffix = metrics.upcomingObligations > 0
      ? ", pero todavía faltan gastos recurrentes por vencer."
      : ".";
    parts.push(`Te queda disponible ${formatMoney(metrics.realAvailable, metrics.currency)}${suffix}`);
  } else {
    parts.push("El disponible real está en negativo al contemplar las obligaciones pendientes.");
  }
  return parts.join(" ");
}
