export type AwarenessTarget =
  | "smart-import"
  | "budgets"
  | "recurring"
  | "debts"
  | "household"
  | "activity"
  | "data-quality";

export type AwarenessTone = "info" | "attention" | "calm";

export type AwarenessSignal = {
  target: AwarenessTarget;
  count: number;
  label: string;
  tone: AwarenessTone;
};

export type ContextualEntryPoint = {
  id: AwarenessTarget;
  title: string;
  body: string;
  href: string;
  tone: AwarenessTone;
  label: string;
};

export type NavigationAwareness = {
  signals: Partial<Record<AwarenessTarget, AwarenessSignal>>;
  entryPoints: ContextualEntryPoint[];
};

export type NavigationAwarenessInput = {
  canSmartImport: boolean;
  hasTransactions: boolean;
  uncategorizedCount: number;
  frequentGroupCount: number;
  budgetsAtRiskCount: number;
  recurringDueCount: number;
  debtsDueCount: number;
  openSharedItems: number;
  pendingHouseholdInvites: number;
  unreadActivityCount: number;
};

export const EMPTY_NAVIGATION_AWARENESS: NavigationAwareness = {
  signals: {},
  entryPoints: [],
};

export function buildNavigationAwareness(input: NavigationAwarenessInput): NavigationAwareness {
  const signals: Partial<Record<AwarenessTarget, AwarenessSignal>> = {};
  const entryPoints: ContextualEntryPoint[] = [];

  const dataQualityCount = input.uncategorizedCount + input.frequentGroupCount;
  const householdCount = input.openSharedItems + input.pendingHouseholdInvites;

  if (input.canSmartImport && !input.hasTransactions) {
    signals["smart-import"] = {
      target: "smart-import",
      count: 0,
      label: "Rápido",
      tone: "info",
    };
    entryPoints.push({
      id: "smart-import",
      title: "Traé movimientos sin cargar a mano",
      body: "Smart Import lee capturas, PDFs o CSV y te deja revisar antes de guardar.",
      href: "/smart-import",
      tone: "info",
      label: "Import",
    });
  }

  if (input.recurringDueCount > 0) {
    signals.recurring = {
      target: "recurring",
      count: input.recurringDueCount,
      label: `${input.recurringDueCount} pendiente${input.recurringDueCount === 1 ? "" : "s"}`,
      tone: "attention",
    };
    entryPoints.push({
      id: "recurring",
      title: "Pagos recurrentes cerca",
      body: "Revisá lo que vence para que el mes no te sorprenda.",
      href: "/recurring",
      tone: "attention",
      label: "Recurrentes",
    });
  }

  if (input.budgetsAtRiskCount > 0) {
    signals.budgets = {
      target: "budgets",
      count: input.budgetsAtRiskCount,
      label: "Atención",
      tone: "attention",
    };
    entryPoints.push({
      id: "budgets",
      title: "Presupuesto en zona sensible",
      body: "Hay categorías cerca del límite. Conviene mirarlas antes del cierre.",
      href: "/budgets",
      tone: "attention",
      label: "Presupuesto",
    });
  }

  if (dataQualityCount > 0) {
    signals["data-quality"] = {
      target: "data-quality",
      count: dataQualityCount,
      label: `${dataQualityCount}`,
      tone: "calm",
    };
    entryPoints.push({
      id: "data-quality",
      title: "Datos para ordenar",
      body: "Hay movimientos sin categoría o patrones repetidos listos para limpiar.",
      href: "/settings/data-quality",
      tone: "calm",
      label: "Ordenar",
    });
  }

  if (householdCount > 0) {
    signals.household = {
      target: "household",
      count: householdCount,
      label: `${householdCount}`,
      tone: "calm",
    };
    entryPoints.push({
      id: "household",
      title: "Hogar con cosas por resolver",
      body: "Revisá invitaciones o gastos compartidos abiertos.",
      href: "/household",
      tone: "calm",
      label: "Hogar",
    });
  }

  if (input.debtsDueCount > 0) {
    signals.debts = {
      target: "debts",
      count: input.debtsDueCount,
      label: `${input.debtsDueCount} cerca`,
      tone: "attention",
    };
    entryPoints.push({
      id: "debts",
      title: "Deudas con vencimiento cercano",
      body: "Tené a mano mínimos, saldos y próximos pagos.",
      href: "/debts",
      tone: "attention",
      label: "Deudas",
    });
  }

  if (input.unreadActivityCount > 0) {
    signals.activity = {
      target: "activity",
      count: input.unreadActivityCount,
      label: `${input.unreadActivityCount}`,
      tone: "info",
    };
    entryPoints.push({
      id: "activity",
      title: "Actividad nueva",
      body: "Hay señales recientes para revisar cuando tengas un minuto.",
      href: "/notifications",
      tone: "info",
      label: "Actividad",
    });
  }

  return {
    signals,
    entryPoints: entryPoints.slice(0, 4),
  };
}
