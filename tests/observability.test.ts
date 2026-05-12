import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAiEnabled, isSmartImportEnabled } from "../lib/feature-flags";
import { sanitizeForTelemetry } from "../lib/observability/sanitize";

describe("beta operability controls", () => {
  it("redacts financial and private fields from telemetry payloads", () => {
    assert.deepEqual(
      sanitizeForTelemetry({
        route: "/dashboard",
        amount: 1234,
        nested: {
          balance: 999,
          status: "failed",
          prompt: "private prompt",
        },
      }),
      {
        route: "/dashboard",
        amount: "[redacted]",
        nested: {
          balance: "[redacted]",
          status: "failed",
          prompt: "[redacted]",
        },
      },
    );
  });

  it("supports AI and Smart Import kill switches plus beta allowlist", () => {
    const previousAi = process.env.DISABLE_AI;
    const previousSmartImport = process.env.DISABLE_SMART_IMPORT;
    const previousAllowlist = process.env.BETA_ALLOWLIST_EMAILS;

    try {
      process.env.BETA_ALLOWLIST_EMAILS = "beta@example.com";
      process.env.DISABLE_AI = "";
      process.env.DISABLE_SMART_IMPORT = "";

      assert.equal(isAiEnabled("beta@example.com"), true);
      assert.equal(isAiEnabled("other@example.com"), false);
      assert.equal(isSmartImportEnabled("beta@example.com"), true);

      process.env.DISABLE_SMART_IMPORT = "1";
      assert.equal(isAiEnabled("beta@example.com"), true);
      assert.equal(isSmartImportEnabled("beta@example.com"), false);

      process.env.DISABLE_AI = "1";
      process.env.DISABLE_SMART_IMPORT = "";
      assert.equal(isAiEnabled("beta@example.com"), false);
      assert.equal(isSmartImportEnabled("beta@example.com"), false);
    } finally {
      process.env.DISABLE_AI = previousAi;
      process.env.DISABLE_SMART_IMPORT = previousSmartImport;
      process.env.BETA_ALLOWLIST_EMAILS = previousAllowlist;
    }
  });
});
