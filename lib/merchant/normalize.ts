/**
 * Merchant name canonicalization — deterministic, no ML, no fuzzy matching.
 * Strips known payment prefixes, terminal/reference codes, and legal suffixes.
 * Conservative: when uncertain, keeps the original text intact.
 */

// Bank/processor payment instruction prefixes
const PREFIX_PATTERN =
  /^(COMPRA\s+(EN|A)\s+|PAGO\s+(EN|A|DE)\s+|DEBIN\s+|D[ÉE]BITO\s+(AUTOM[ÁA]TICO\s+)?|TRANSFERENCIA\s+(A\s+)?|EXTRACCION\s+|RETIRO\s+|FACTURA\s+|CUOTA\s+\d+\s+DE\s+\d+\s+(DE\s+)?)/i;

// Legal entity suffixes (Argentine/LATAM)
const LEGAL_SUFFIX_PATTERN =
  /\s+(S\.?A\.?S\.?|S\.?R\.?L\.?|S\.?C\.?A\.?|SACIF|SAICF|SRL|SA|SCA)\b.*$/i;

// Trailing terminal/reference codes: /12345  #12345  -12345  *12345  or bare 4+ digits at end
const TERMINAL_PATTERN = /[\s*/\-#]+\d{4,}(\s.*)?$/;

// CUIT / CUIL reference appended by processors
const CUIT_PATTERN = /\s+C\.?U\.?I\.?[TL]\.?\s+[\d\-]+$/i;

export function normalizeMerchant(description: string | null | undefined): string {
  if (!description) return "";

  let s = description
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toUpperCase()
    .trim();

  // 1. Strip payment prefixes
  s = s.replace(PREFIX_PATTERN, "");

  // 2. Strip CUIT/CUIL
  s = s.replace(CUIT_PATTERN, "");

  // 3. Strip terminal/reference codes from the end
  s = s.replace(TERMINAL_PATTERN, "");

  // 4. Strip legal entity suffixes
  s = s.replace(LEGAL_SUFFIX_PATTERN, "");

  // 5. Normalize internal whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s.slice(0, 60);
}
