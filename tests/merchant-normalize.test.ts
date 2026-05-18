import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMerchantIdentity, normalizeMerchant, toDisplayName } from "../lib/merchant/normalize";

// ── Core bug regression ───────────────────────────────────────────────────────
describe("normalizeMerchant — core bug: Buen Libro / Comida Buen Libro", () => {
  it("'Buen Libro' canonical is 'BUEN LIBRO'", () => {
    assert.equal(normalizeMerchant("Buen Libro"), "BUEN LIBRO");
  });

  it("'Comida Buen Libro' canonical is 'BUEN LIBRO' (strips context prefix)", () => {
    assert.equal(normalizeMerchant("Comida Buen Libro"), "BUEN LIBRO");
  });

  it("'Buen Libro' and 'Comida Buen Libro' produce identical canonical → group together", () => {
    assert.equal(normalizeMerchant("Buen Libro"), normalizeMerchant("Comida Buen Libro"));
  });

  it("'Delivery Buen Libro' also maps to 'BUEN LIBRO'", () => {
    assert.equal(normalizeMerchant("Delivery Buen Libro"), "BUEN LIBRO");
  });

  it("'Almuerzo Buen Libro' also maps to 'BUEN LIBRO'", () => {
    assert.equal(normalizeMerchant("Almuerzo Buen Libro"), "BUEN LIBRO");
  });
});

// ── Guardrail: BUENLIBRO SA / Buen Libro ─────────────────────────────────────
describe("normalizeMerchant — test 2: BUENLIBRO SA / Buen Libro (conservative)", () => {
  it("'BUENLIBRO SA' strips legal suffix → 'BUENLIBRO'", () => {
    assert.equal(normalizeMerchant("BUENLIBRO SA"), "BUENLIBRO");
  });

  it("'Buen Libro' canonical is 'BUEN LIBRO'", () => {
    assert.equal(normalizeMerchant("Buen Libro"), "BUEN LIBRO");
  });

  it("'BUENLIBRO SA' and 'Buen Libro' remain distinct — space normalization out of scope", () => {
    // Conservative: merging names that differ only by a space requires fuzzy matching.
    // Intentionally left separate to avoid false positives.
    assert.notEqual(normalizeMerchant("BUENLIBRO SA"), normalizeMerchant("Buen Libro"));
  });
});

// ── Guardrail: Casa Juan / Juan Café must NOT merge ───────────────────────────
describe("normalizeMerchant — test 3: Casa Juan / Juan Café (must NOT merge)", () => {
  it("'Casa Juan' canonical is 'CASA JUAN' (Casa not in context-prefix list)", () => {
    assert.equal(normalizeMerchant("Casa Juan"), "CASA JUAN");
  });

  it("'Juan Café' canonical is 'JUAN CAFE'", () => {
    assert.equal(normalizeMerchant("Juan Café"), "JUAN CAFE");
  });

  it("'Casa Juan' and 'Juan Café' have different canonicals", () => {
    assert.notEqual(normalizeMerchant("Casa Juan"), normalizeMerchant("Juan Café"));
  });
});

// ── Guardrail: Coto / Coto Digital ───────────────────────────────────────────
describe("normalizeMerchant — test 4: Coto / Coto Digital (conservative, do NOT merge)", () => {
  it("'Coto' canonical is 'COTO'", () => {
    assert.equal(normalizeMerchant("Coto"), "COTO");
  });

  it("'Coto Digital' canonical is 'COTO DIGITAL'", () => {
    assert.equal(normalizeMerchant("Coto Digital"), "COTO DIGITAL");
  });

  it("'Coto' and 'Coto Digital' have different canonicals", () => {
    assert.notEqual(normalizeMerchant("Coto"), normalizeMerchant("Coto Digital"));
  });
});

// ── Context prefix minimum-length guardrail ───────────────────────────────────
describe("normalizeMerchant — context prefix min-length guardrail", () => {
  it("does NOT strip 'Delivery' when remaining is only 4 chars (< 5)", () => {
    // "Delivery Juan" → strip → "Juan" (4 chars) → below minimum → keep full string
    assert.equal(normalizeMerchant("Delivery Juan"), "DELIVERY JUAN");
  });

  it("does NOT strip 'Comida' when remaining is 4 chars", () => {
    assert.equal(normalizeMerchant("Comida Coto"), "COMIDA COTO"); // "COTO" = 4 chars
  });

  it("DOES strip 'Comida' when remaining is 5+ chars", () => {
    assert.equal(normalizeMerchant("Comida Arcor"), "ARCOR"); // "ARCOR" = 5 chars ✅
  });
});

// ── Bank/processor prefix stripping ──────────────────────────────────────────
describe("normalizeMerchant — bank prefix stripping", () => {
  it("strips 'COMPRA EN'", () => {
    assert.equal(normalizeMerchant("COMPRA EN BUEN LIBRO"), "BUEN LIBRO");
  });

  it("strips 'COMPRA A'", () => {
    assert.equal(normalizeMerchant("COMPRA A BUEN LIBRO"), "BUEN LIBRO");
  });

  it("strips 'PAGO A'", () => {
    assert.equal(normalizeMerchant("PAGO A BUEN LIBRO"), "BUEN LIBRO");
  });

  it("strips 'PAGO EN'", () => {
    assert.equal(normalizeMerchant("PAGO EN BUEN LIBRO"), "BUEN LIBRO");
  });

  it("strips 'DEBIN'", () => {
    assert.equal(normalizeMerchant("DEBIN BUEN LIBRO"), "BUEN LIBRO");
  });

  it("strips 'DÉBITO AUTOMÁTICO'", () => {
    assert.equal(normalizeMerchant("DÉBITO AUTOMÁTICO BUEN LIBRO"), "BUEN LIBRO");
  });

  it("strips 'TRANSFERENCIA A'", () => {
    assert.equal(normalizeMerchant("TRANSFERENCIA A BUEN LIBRO"), "BUEN LIBRO");
  });
});

// ── Terminal code stripping ───────────────────────────────────────────────────
describe("normalizeMerchant — terminal code stripping", () => {
  it("strips '/12345' suffix", () => {
    assert.equal(normalizeMerchant("Buen Libro /12345"), "BUEN LIBRO");
  });

  it("strips '#5678' suffix", () => {
    assert.equal(normalizeMerchant("Buen Libro #5678"), "BUEN LIBRO");
  });

  it("strips '-9999' suffix", () => {
    assert.equal(normalizeMerchant("Buen Libro -9999"), "BUEN LIBRO");
  });

  it("does NOT strip short number (< 4 digits)", () => {
    // A 3-digit number is likely part of the name, not a terminal code
    assert.equal(normalizeMerchant("Librería 123"), "LIBRERIA 123");
  });
});

// ── Legal suffix stripping ────────────────────────────────────────────────────
describe("normalizeMerchant — legal suffix stripping", () => {
  it("strips 'S.A.'", () => {
    assert.equal(normalizeMerchant("Buen Libro S.A."), "BUEN LIBRO");
  });

  it("strips 'SRL'", () => {
    assert.equal(normalizeMerchant("Buen Libro SRL"), "BUEN LIBRO");
  });

  it("strips 'S.R.L.'", () => {
    assert.equal(normalizeMerchant("Buen Libro S.R.L."), "BUEN LIBRO");
  });

  it("strips 'SACIF'", () => {
    assert.equal(normalizeMerchant("Buen Libro SACIF"), "BUEN LIBRO");
  });
});

// ── Accent normalization ──────────────────────────────────────────────────────
describe("normalizeMerchant — accent normalization", () => {
  it("strips accents — é → e", () => {
    assert.equal(normalizeMerchant("Café El Patio"), "CAFE EL PATIO");
  });

  it("strips accents — ú → u", () => {
    assert.equal(normalizeMerchant("Almacén Único"), "ALMACEN UNICO");
  });

  it("strips accents from context prefix word", () => {
    // "Café Buen Libro" — CAFE not in context-prefix list, so no stripping of "CAFE"
    // Result should preserve both words
    assert.equal(normalizeMerchant("Café Buen Libro"), "CAFE BUEN LIBRO");
  });
});

// ── Null/empty safety ─────────────────────────────────────────────────────────
describe("normalizeMerchant — null/empty safety", () => {
  it("returns '' for null", () => {
    assert.equal(normalizeMerchant(null), "");
  });

  it("returns '' for undefined", () => {
    assert.equal(normalizeMerchant(undefined), "");
  });

  it("returns '' for empty string", () => {
    assert.equal(normalizeMerchant(""), "");
  });

  it("returns '' for whitespace-only", () => {
    assert.equal(normalizeMerchant("   "), "");
  });
});

// ── toDisplayName ─────────────────────────────────────────────────────────────
describe("toDisplayName", () => {
  it("title-cases 'BUEN LIBRO' → 'Buen Libro'", () => {
    assert.equal(toDisplayName("BUEN LIBRO"), "Buen Libro");
  });

  it("title-cases single word 'COTO' → 'Coto'", () => {
    assert.equal(toDisplayName("COTO"), "Coto");
  });

  it("returns '' for empty string", () => {
    assert.equal(toDisplayName(""), "");
  });

  it("handles already-lowercase input", () => {
    assert.equal(toDisplayName("buen libro"), "Buen Libro");
  });
});

// ── getMerchantIdentity ───────────────────────────────────────────────────────
describe("getMerchantIdentity", () => {
  it("returns correct identity for 'Comida Buen Libro'", () => {
    const id = getMerchantIdentity("Comida Buen Libro");
    assert.equal(id.rawDescription, "Comida Buen Libro");
    assert.equal(id.canonicalMerchant, "BUEN LIBRO");
    assert.equal(id.displayName, "Buen Libro");
  });

  it("returns correct identity for 'Buen Libro'", () => {
    const id = getMerchantIdentity("Buen Libro");
    assert.equal(id.rawDescription, "Buen Libro");
    assert.equal(id.canonicalMerchant, "BUEN LIBRO");
    assert.equal(id.displayName, "Buen Libro");
  });

  it("both variants produce same canonicalMerchant and displayName (AI payload dedup)", () => {
    const id1 = getMerchantIdentity("Buen Libro");
    const id2 = getMerchantIdentity("Comida Buen Libro");
    assert.equal(id1.canonicalMerchant, id2.canonicalMerchant);
    assert.equal(id1.displayName, id2.displayName);
  });

  it("preserves rawDescription exactly — including bank prefix and codes", () => {
    const raw = "COMPRA EN BUEN LIBRO #12345 S.A.";
    const id = getMerchantIdentity(raw);
    assert.equal(id.rawDescription, raw);
    assert.equal(id.canonicalMerchant, "BUEN LIBRO");
    assert.equal(id.displayName, "Buen Libro");
  });

  it("rawDescription is never mutated — canonical goes through normalization only", () => {
    const raw = "Comida Buen Libro";
    const id = getMerchantIdentity(raw);
    assert.equal(id.rawDescription, raw); // original preserved exactly
    assert.notEqual(id.canonicalMerchant, raw); // canonical is different
  });

  it("returns empty identity for null", () => {
    const id = getMerchantIdentity(null);
    assert.equal(id.rawDescription, "");
    assert.equal(id.canonicalMerchant, "");
    assert.equal(id.displayName, "");
  });

  // ── Test 5: repeatedSmallExpenses grouping — canonical equality implies grouping ─
  it("test 5 — grouping: 'Buen Libro' and 'Comida Buen Libro' share canonical key (no duplicate in repeatedSmallExpenses)", () => {
    const descriptions = ["Buen Libro", "Comida Buen Libro", "Delivery Buen Libro"];
    const keys = descriptions.map((d) => normalizeMerchant(d));
    const uniqueKeys = new Set(keys);
    // All three should collapse to the same key → group count = 1
    assert.equal(uniqueKeys.size, 1, `Expected 1 unique key, got ${uniqueKeys.size}: ${JSON.stringify([...uniqueKeys])}`);
  });

  // ── Test 6: AI payload — canonical used, not variant ─────────────────────────
  it("test 6 — AI payload: displayName is the canonical, not a random variant", () => {
    const variants = ["Buen Libro", "Comida Buen Libro", "Delivery Buen Libro"];
    for (const v of variants) {
      const { displayName } = getMerchantIdentity(v);
      assert.equal(displayName, "Buen Libro", `Expected "Buen Libro" for "${v}", got "${displayName}"`);
    }
  });

  // ── Test 7: recurring detection — same canonical key, no duplicates ───────────
  it("test 7 — recurring detection: variants of same merchant produce identical grouping key", () => {
    // Simulate the key used in detectRecurringExpenses: canonical|category|amountBucket
    function buildRecurringKey(description: string, category: string, amount: number) {
      const canonical = normalizeMerchant(description);
      const amountBucket = Math.round(amount / 100) * 100;
      return `${canonical}|${category}|${amountBucket}`;
    }

    const keyA = buildRecurringKey("Buen Libro", "Libros", 1500);
    const keyB = buildRecurringKey("Comida Buen Libro", "Libros", 1500);
    assert.equal(keyA, keyB, "Different description variants must produce the same recurring detection key");
  });
});
