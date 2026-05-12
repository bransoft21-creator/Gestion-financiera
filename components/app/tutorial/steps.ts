import type { TutorialStepDef } from "./types";

export const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    id: "welcome",
    type: "overlay",
    title: "Bienvenido a Financial OS",
    description:
      "Te mostramos los elementos principales de la app en menos de un minuto. Podés saltar en cualquier momento.",
  },
  {
    id: "navigation",
    targets: ["[data-tutorial='nav-mobile']", "[data-tutorial='nav-desktop']"],
    highlightPadding: 6,
    title: "Navegación principal",
    description:
      "Desde acá accedés al Dashboard, Movimientos, Presupuesto, Metas y todas las secciones del sistema.",
  },
  {
    id: "privacy",
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
    id: "notifications",
    targets: [
      "[data-tutorial='notifications-mobile']",
      "[data-tutorial='notifications-desktop']",
    ],
    highlightPadding: 10,
    title: "Centro de actividad",
    description:
      "Acá llegan señales, insights y alertas generadas por el sistema sobre tus finanzas.",
  },
  {
    id: "done",
    type: "overlay",
    title: "¡Ya conocés lo esencial!",
    description:
      "Explorá el resto a tu ritmo. Podés repetir este tour desde tu perfil en cualquier momento.",
  },
];
