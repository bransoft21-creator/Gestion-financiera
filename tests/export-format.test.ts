import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExportMetadata,
  EXPORT_SCHEMA_VERSION,
  formatTransactionsCsv,
} from "../server/services/export-format";

test("buildExportMetadata includes trust metadata and safe defaults", () => {
  const metadata = buildExportMetadata({
    exportedAt: "2026-05-16T12:00:00.000Z",
    timezone: null,
    locale: null,
    appVersion: "0.1.0",
    format: "json",
    householdId: "household_1",
    recordCounts: { transactions: 2 },
  });

  assert.equal(metadata.schemaVersion, EXPORT_SCHEMA_VERSION);
  assert.equal(metadata.timezone, "America/Argentina/Buenos_Aires");
  assert.equal(metadata.locale, "es-AR");
  assert.equal(metadata.householdId, "household_1");
  assert.deepEqual(metadata.recordCounts, { transactions: 2 });
});

test("formatTransactionsCsv escapes descriptions and keeps stable columns", () => {
  const csv = formatTransactionsCsv([
    {
      occurredAt: new Date("2026-05-16T10:00:00.000Z"),
      type: "EXPENSE",
      status: "CONFIRMED",
      currency: "ARS",
      amount: 1234.5,
      description: "Super, barrio \"Centro\"",
      accountName: "Cuenta principal",
      categoryName: null,
      expenseType: "VARIABLE",
      isRecurring: false,
      isInstallment: true,
    },
  ]);

  assert.match(csv, /^occurredAt,type,status,currency,amount,description,accountName,categoryName,expenseType,isRecurring,isInstallment\n/);
  assert.match(csv, /"Super, barrio ""Centro"""/);
  assert.match(csv, /Cuenta principal,,VARIABLE,false,true\n$/);
});
