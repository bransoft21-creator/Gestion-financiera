/**
 * Merchant name canonicalization — deterministic, no ML, no fuzzy matching.
 * Conservative: when uncertain, keeps the original text intact.
 *
 * Single source of truth used by:
 *  - server/services/ai-monthly-analysis.ts  (repeatedSmallExpenses, recurringDetection)
 *  - server/services/data-quality.ts         (getSimilarMerchants, getQualitySignals)
 */

// ── Bank/processor payment instruction prefixes ───────────────────────────────
const PREFIX_PATTERN =
  /^(COMPRA\s+(EN|A)\s+|PAGO\s+(EN|A|DE)\s+|DEBIN\s+|D[ÉE]BITO\s+(AUTOM[ÁA]TICO\s+)?|TRANSFERENCIA\s+(A\s+)?|EXTRACCION\s+|RETIRO\s+|FACTURA\s+|CUOTA\s+\d+\s+DE\s+\d+\s+(DE\s+)?)/i;

// ── Legal entity suffixes (Argentine/LATAM) ───────────────────────────────────
//
// Fixes vs. naive pattern:
//  • S\.?A\.?S?\.?  — makes the trailing S optional so "S.A." (no final S) matches
//  • (?!\w) replaces \b — \b fails when the suffix ends in "." (non-word char at EOL)
//
const LEGAL_SUFFIX_PATTERN =
  /\s+(S\.?A\.?S?\.?|S\.?R\.?L\.?|S\.?C\.?A\.?|SACIF|SAICF|SRL|SA|SCA)(?!\w).*$/i;

// ── Trailing terminal/reference codes: /12345  #12345  -12345  *12345 ─────────
const TERMINAL_PATTERN = /[\s*/\-#]+\d{4,}(\s.*)?$/;

// ── CUIT / CUIL appended by processors ───────────────────────────────────────
const CUIT_PATTERN = /\s+C\.?U\.?I\.?[TL]\.?\s+[\d\-]+$/i;

// ── Context/category prefix words ────────────────────────────────────────────
//
// These are words that appear BEFORE the actual merchant name as category context.
// Added by users during manual entry ("Comida Buen Libro") or by importers.
// They are NEVER intrinsic to the merchant identity.
//
// Conservative list — only words that:
//   (a) clearly indicate context, not merchant type (exclude: CAFE, RESTAURANTE, TIENDA)
//   (b) would never be the entire merchant name on their own
//
// Guardrail: only strip when the remaining string is ≥ MIN_CONTEXT_REMAINING chars.
//            This prevents "Delivery Juan" → "JUAN" (4 chars < 5 → keep intact).
//
const CONTEXT_PREFIX_WORDS = [
  "ALMUERZO",
  "CENA",
  "DESAYUNO",
  "MERIENDA",
  "COMIDA",
  "DELIVERY",
  "PEDIDO",
  "DESPACHO",
] as const;

const CONTEXT_PREFIX_RE = new RegExp(
  `^(${CONTEXT_PREFIX_WORDS.join("|")})\\s+`,
  "i",
);
const MIN_CONTEXT_REMAINING = 5;

// ── Core normalization ────────────────────────────────────────────────────────

/**
 * Returns the canonical uppercase merchant name.
 * Use this as the grouping key in aggregations and AI payloads.
 *
 * Does NOT modify the original rawDescription — the caller keeps that separately.
 */
export function normalizeMerchant(description: string | null | undefined): string {
  if (!description) return "";

  let s = description
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics (NFD decomposition)
    .toUpperCase()
    .trim();

  // 1. Strip bank/processor prefixes
  s = s.replace(PREFIX_PATTERN, "");

  // 2. Strip CUIT/CUIL
  s = s.replace(CUIT_PATTERN, "");

  // 3. Strip trailing terminal/reference codes
  s = s.replace(TERMINAL_PATTERN, "");

  // 4. Strip legal entity suffixes
  s = s.replace(LEGAL_SUFFIX_PATTERN, "");

  // 5. Strip context/category prefix words — only when the remainder is long enough.
  //    Guards against: "Delivery Juan" → "JUAN" (4 chars) → skip, keep "DELIVERY JUAN".
  const prefixMatch = CONTEXT_PREFIX_RE.exec(s);
  if (prefixMatch) {
    const remaining = s.slice(prefixMatch[0].length).trim();
    if (remaining.length >= MIN_CONTEXT_REMAINING) {
      s = remaining;
    }
  }

  // 6. Normalize internal whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s.slice(0, 60);
}

// ── Display helpers ───────────────────────────────────────────────────────────

/**
 * Title-cases an uppercase canonical for UI display.
 * "BUEN LIBRO" → "Buen Libro"
 */
export function toDisplayName(canonical: string): string {
  if (!canonical) return "";
  return canonical
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (ch) => ch.toUpperCase());
}

// ── Identity object ───────────────────────────────────────────────────────────

export interface MerchantIdentity {
  /** Original description as entered/imported — never modified. For audit/debug only. */
  rawDescription: string;
  /** Canonical uppercase merchant name — use as grouping key and in AI payloads. */
  canonicalMerchant: string;
  /** Title-cased canonical — use for user-facing display. */
  displayName: string;
}

/**
 * Returns the full merchant identity for a transaction description.
 *
 * @example
 * getMerchantIdentity("Comida Buen Libro")
 * // → { rawDescription: "Comida Buen Libro", canonicalMerchant: "BUEN LIBRO", displayName: "Buen Libro" }
 *
 * getMerchantIdentity("COMPRA EN BUEN LIBRO #12345 S.A.")
 * // → { rawDescription: "COMPRA EN BUEN LIBRO #12345 S.A.", canonicalMerchant: "BUEN LIBRO", displayName: "Buen Libro" }
 */
export function getMerchantIdentity(
  description: string | null | undefined,
): MerchantIdentity {
  const raw = description ?? "";
  const canonical = normalizeMerchant(raw);
  return {
    rawDescription: raw,
    canonicalMerchant: canonical,
    displayName: toDisplayName(canonical),
  };
}
