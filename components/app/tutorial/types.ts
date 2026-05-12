export type TutorialStepDef = {
  id: string;
  type?: "spotlight" | "overlay";
  /** Ruta en la que debe visualizarse este paso (e.g. "/dashboard") */
  route?: string;
  /** CSS selectors to try in order; first visible element wins */
  targets?: string[];
  highlightPadding?: number;
  title: string;
  description: string;
  /** Label del botón CTA (reemplaza "Siguiente") */
  ctaLabel?: string;
  /** Ruta a la que navegar al presionar el CTA del último paso */
  ctaRoute?: string;
};
