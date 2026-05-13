import type { TutorialStepDef } from "./types";

export const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    id: "welcome",
    type: "overlay",
    route: "/dashboard",
    title: "Bienvenido a Meridian",
    description:
      "Te mostramos los elementos clave en menos de un minuto. Podés saltar en cualquier momento.",
  },
  {
    id: "dashboard-hero",
    route: "/dashboard",
    targets: ["[data-tutorial='dashboard-hero']"],
    highlightPadding: 8,
    title: "Disponible real del mes",
    description:
      "Esta tarjeta resume tu salud financiera: ingresos, gastos y cuánto dinero respirás este mes.",
  },
  {
    id: "financial-copilot",
    route: "/dashboard",
    targets: ["[data-tutorial='financial-copilot']"],
    highlightPadding: 8,
    title: "Copiloto financiero con IA",
    description:
      "Análisis automático de tu situación mensual — puntos fuertes, alertas y recomendaciones personalizadas.",
  },
  {
    id: "privacy",
    route: "/dashboard",
    targets: [
      "[data-tutorial='privacy-toggle-mobile']",
      "[data-tutorial='privacy-toggle-desktop']",
    ],
    highlightPadding: 10,
    title: "Modo privado",
    description:
      "Un toque oculta todos los montos de la pantalla. Útil cuando estás en público o compartís pantalla.",
  },
  {
    id: "transactions",
    route: "/transactions",
    targets: ["[data-tutorial='transactions-feed']"],
    highlightPadding: 8,
    title: "Feed de movimientos",
    description:
      "Todos tus ingresos y gastos en un solo lugar. Filtrá, buscá y exportá con un click.",
  },
  {
    id: "smart-import",
    route: "/smart-import",
    targets: ["[data-tutorial='smart-import-dropzone']"],
    highlightPadding: 12,
    title: "Smart Import",
    description:
      "Arrastrá un resumen bancario o PDF y la IA extrae y categoriza tus movimientos automáticamente.",
  },
  {
    id: "notifications",
    route: "/notifications",
    targets: ["[data-tutorial='activity-center']"],
    highlightPadding: 8,
    title: "Centro de actividad",
    description:
      "Señales, insights y alertas generadas por el sistema sobre tus finanzas en tiempo real.",
  },
  {
    id: "profile",
    route: "/profile",
    targets: ["[data-tutorial='profile-summary']"],
    highlightPadding: 8,
    title: "Tu perfil",
    description:
      "Gestioná tu cuenta, preferencias y seguridad. También podés repetir este tour desde acá.",
  },
  {
    id: "done",
    type: "overlay",
    title: "¡Ya sos un experto!",
    description:
      "Ahora conocés las herramientas principales. Explorá a tu ritmo y repetí este tour desde tu perfil cuando quieras.",
    ctaLabel: "Ir al dashboard",
    ctaRoute: "/dashboard",
  },
];
