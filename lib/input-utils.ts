import type { KeyboardEvent } from "react";

const NAV_KEYS = new Set([
  "Backspace", "Delete", "Tab", "Enter", "Escape",
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "Home", "End",
]);

/**
 * Blocks non-monetary characters from money/decimal inputs.
 * Allows: digits 0-9, decimal separators (. ,), navigation keys, clipboard shortcuts.
 */
export function onMoneyKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
  if (NAV_KEYS.has(e.key) || e.ctrlKey || e.metaKey) return;
  if (!/[\d.,]/.test(e.key)) e.preventDefault();
}

/**
 * Blocks non-integer characters from whole-number inputs.
 * Allows: digits 0-9, navigation keys, clipboard shortcuts.
 */
export function onIntegerKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
  if (NAV_KEYS.has(e.key) || e.ctrlKey || e.metaKey) return;
  if (!/\d/.test(e.key)) e.preventDefault();
}
