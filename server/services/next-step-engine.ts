import type { OnboardingGoal } from "../schemas/onboarding";

export type ActivationActionId =
  | "create-account"
  | "first-income"
  | "smart-import"
  | "setup-household"
  | "shared-expense"
  | "invite-household"
  | "setup-budgets"
  | "organize-debts"
  | "review-movements"
  | "setup-recurring";

export type ActivationAction = {
  id: ActivationActionId;
  title: string;
  description: string;
  href: string;
  reason: string;
};

export type NextStepContext = {
  onboardingGoals: OnboardingGoal[];
  hasAccounts: boolean;
  hasTransactions: boolean;
  hasSharedHousehold: boolean;
  hasBudgets: boolean;
  hasRecurringExpenses: boolean;
  hasActiveDebts: boolean;
  canSmartImport: boolean;
  onboardingCompletedAt: Date | null;
  now?: Date;
};

export type NextStepRecommendation = {
  shouldShow: boolean;
  headline: string;
  body: string;
  actions: ActivationAction[];
  primaryAction: ActivationAction | null;
  isOnboardingFresh: boolean;
};

const FRESH_ONBOARDING_MS = 7 * 24 * 60 * 60 * 1000;

const goalOrder: OnboardingGoal[] = [
  "salir-excel",
  "compartir-hogar",
  "organizar-deudas",
  "ahorrar",
  "entender-gastos",
];

export function buildNextStepRecommendation(context: NextStepContext): NextStepRecommendation {
  const now = context.now ?? new Date();
  const isOnboardingFresh = Boolean(
    context.onboardingCompletedAt &&
      now.getTime() - context.onboardingCompletedAt.getTime() <= FRESH_ONBOARDING_MS,
  );
  const hasEmptyDashboard = !context.hasAccounts || !context.hasTransactions;
  const actions = uniqueActions([
    ...getPrerequisiteActions(context),
    ...getGoalActions(context),
    ...getFallbackActions(context),
  ]).slice(0, 3);

  return {
    shouldShow: actions.length > 0 && (hasEmptyDashboard || isOnboardingFresh),
    headline: getHeadline(context),
    body: getBody(context),
    actions,
    primaryAction: actions[0] ?? null,
    isOnboardingFresh,
  };
}

function getPrerequisiteActions(context: NextStepContext): ActivationAction[] {
  if (!context.hasAccounts) {
    return [
      {
        id: "create-account",
        title: "Agregá tu primera cuenta",
        description: "Elegí billetera, banco o efectivo para ubicar tu dinero.",
        href: "/accounts",
        reason: "Sin cuentas, Meridian no puede ordenar movimientos.",
      },
    ];
  }

  return [];
}

function getGoalActions(context: NextStepContext): ActivationAction[] {
  const sortedGoals = [...context.onboardingGoals].sort(
    (a, b) => goalOrder.indexOf(a) - goalOrder.indexOf(b),
  );

  return sortedGoals.flatMap((goal): ActivationAction[] => {
    switch (goal) {
      case "salir-excel":
        return context.canSmartImport
          ? [{
              id: "smart-import",
              title: "Importá una captura o PDF",
              description: "Probá Smart Import y revisá los movimientos antes de guardar.",
              href: "/smart-import",
              reason: "Elegiste salir del Excel.",
            }]
          : [];
      case "compartir-hogar":
        return context.hasSharedHousehold
          ? [
              {
                id: "shared-expense",
                title: "Agregá un gasto compartido",
                description: "Cargá el primer gasto del hogar y dividilo con contexto.",
                href: "/transactions?new=1",
                reason: "Ya tenés hogar compartido.",
              },
              {
                id: "invite-household",
                title: "Invitá a otra persona",
                description: "Sumá a quien comparte gastos con vos.",
                href: "/household",
                reason: "Elegiste compartir hogar.",
              },
            ]
          : [{
              id: "setup-household",
              title: "Configurá tu hogar",
              description: "Armá un espacio simple para gastos compartidos.",
              href: "/household",
              reason: "Elegiste compartir hogar.",
            }];
      case "organizar-deudas":
        return [{
          id: "organize-debts",
          title: context.hasActiveDebts ? "Revisá tus deudas" : "Cargá una deuda pendiente",
          description: "Poné cuotas, saldos y vencimientos en un solo lugar.",
          href: "/debts",
          reason: "Elegiste ordenar deudas.",
        }];
      case "ahorrar":
        return [{
          id: "setup-budgets",
          title: context.hasBudgets ? "Ajustá tu presupuesto" : "Creá tu primer presupuesto",
          description: "Reservá plata antes de que el mes se mueva solo.",
          href: "/budgets",
          reason: "Elegiste ahorrar.",
        }];
      case "entender-gastos":
        return [{
          id: "review-movements",
          title: context.hasTransactions ? "Leé tus movimientos" : "Cargá un movimiento real",
          description: context.hasTransactions
            ? "Encontrá patrones desde el feed y los insights."
            : "Un ingreso o gasto alcanza para empezar a ver contexto.",
          href: context.hasTransactions ? "/transactions" : "/transactions?new=1",
          reason: "Elegiste entender tus gastos.",
        }];
    }
  });
}

function getFallbackActions(context: NextStepContext): ActivationAction[] {
  const actions: ActivationAction[] = [];

  if (!context.hasTransactions) {
    actions.push({
      id: "first-income",
      title: "Registrá tu primer ingreso",
      description: "Dejá una base clara para el mes actual.",
      href: "/transactions?new=1",
      reason: "Todavía no hay movimientos.",
    });
  }

  if (context.canSmartImport) {
    actions.push({
      id: "smart-import",
      title: "Probá Smart Import",
      description: "Subí una captura, PDF o CSV y evitá cargar todo a mano.",
      href: "/smart-import",
      reason: "Es la forma más rápida de traer datos reales.",
    });
  }

  if (!context.hasBudgets) {
    actions.push({
      id: "setup-budgets",
      title: "Creá un presupuesto",
      description: "Separá una categoría importante y mirala de cerca.",
      href: "/budgets",
      reason: "Todavía no hay presupuestos.",
    });
  }

  if (!context.hasRecurringExpenses) {
    actions.push({
      id: "setup-recurring",
      title: "Sumá un gasto recurrente",
      description: "Alquiler, servicios o suscripciones dejan de sorprenderte.",
      href: "/recurring",
      reason: "Todavía no hay recurrentes.",
    });
  }

  return actions;
}

function uniqueActions(actions: ActivationAction[]) {
  const seen = new Set<ActivationActionId>();
  return actions.filter((action) => {
    if (seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  });
}

function getHeadline(context: NextStepContext) {
  if (!context.hasAccounts) return "Arranquemos con una base simple";
  if (!context.hasTransactions) return "Tu primer dato útil";
  if (context.onboardingGoals.includes("compartir-hogar")) return "Hacé visible el hogar";
  return "Siguiente paso recomendado";
}

function getBody(context: NextStepContext) {
  if (!context.hasAccounts) return "Una cuenta alcanza para que Meridian empiece a ordenar el mapa.";
  if (!context.hasTransactions) return "Traé un movimiento real y el dashboard empieza a hablar.";
  return "Te dejamos el camino más corto según lo que elegiste al entrar.";
}
