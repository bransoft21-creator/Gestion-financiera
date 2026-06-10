import type { TutorialStepDef } from "./types";

export const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    id: "welcome",
    type: "overlay",
    route: "/dashboard",
    title: "Bienvenido a Meridian",
    description:
      "Tu Financial OS personal y familiar. En menos de un minuto te mostramos lo que necesitás para empezar. Podés saltar en cualquier momento.",
  },
  {
    id: "dashboard-hero",
    route: "/dashboard",
    targets: ["[data-tutorial='dashboard-hero']"],
    highlightPadding: 8,
    title: "Tu disponible real",
    description:
      "No es el saldo del banco — es lo que realmente podés gastar: ingresos menos gastos, lo que reservaste para presupuestos y tus obligaciones del mes.",
  },
  {
    id: "financial-copilot",
    route: "/dashboard",
    targets: ["[data-tutorial='financial-copilot']"],
    highlightPadding: 8,
    title: "Análisis IA del mes",
    description:
      "Un análisis automático de tu situación: qué va bien, qué preocupa y qué podés mejorar. Se actualiza con cada movimiento que registrás.",
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
      "Un toque oculta todos los montos de la pantalla. Útil cuando estás en público o compartís pantalla con alguien.",
  },
  {
    id: "transactions",
    route: "/transactions",
    targets: ["[data-tutorial='transactions-feed']"],
    highlightPadding: 8,
    title: "Tus movimientos",
    description:
      "Todos los ingresos y gastos en un solo lugar. En la barra de acciones encontrás 'Importar' para cargar extractos bancarios directamente.",
  },
  {
    id: "smart-import",
    route: "/smart-import",
    targets: ["[data-tutorial='smart-import-dropzone']"],
    highlightPadding: 12,
    title: "Smart Import",
    description:
      "Arrastrá un extracto bancario (PDF o imagen) y la IA lee, categoriza y propone los movimientos. Vos revisás y confirmás antes de que entren.",
  },
  {
    id: "copilot",
    route: "/copilot",
    targets: ["[data-tutorial='copilot-start']"],
    highlightPadding: 12,
    title: "Perspectiva — tu copiloto",
    description:
      "Hacé preguntas sobre tus finanzas en lenguaje natural. Solo responde con tus datos reales de Meridian, sin estimaciones ni datos de terceros.",
  },
  {
    id: "profile",
    route: "/profile",
    targets: ["[data-tutorial='profile-summary']"],
    highlightPadding: 8,
    title: "Tu perfil",
    description:
      "Gestioná tu cuenta, preferencias y privacidad. También podés repetir este recorrido desde acá cuando quieras.",
  },
  {
    id: "done",
    type: "overlay",
    title: "Ya tenés todo para empezar",
    description:
      "Cargá tus primeros movimientos, importá un extracto bancario, o preguntale a Perspectiva sobre tus finanzas. Meridian va creciendo con tu uso.",
    ctaLabel: "Ir al dashboard",
    ctaRoute: "/dashboard",
  },
];
