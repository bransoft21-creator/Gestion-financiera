export type TutorialStepDef = {
  id: string;
  type?: "spotlight" | "overlay";
  /** CSS selectors to try in order; first visible element wins */
  targets?: string[];
  highlightPadding?: number;
  title: string;
  description: string;
};
