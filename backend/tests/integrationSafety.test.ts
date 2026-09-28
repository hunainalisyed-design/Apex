import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// The integration suite wipes the database it runs against. These pin down the wiring that keeps
// it on apex_test, without touching any database.
describe("integration suite wiring", () => {
  it("hands its workers the apex_test URL, and runs the database checks before any test file", async () => {
    // As in CI: only the development URL in the environment, no .env needed.
    vi.stubEnv("DATABASE_URL", "postgresql://apex:apex@localhost:5432/apex_dev?schema=public");
    const { default: integrationConfig } = await import("../vitest.integration.config.js");
    vi.unstubAllEnvs();
    const test = integrationConfig.test!;
    expect(new URL(String(test.env!.DATABASE_URL)).pathname).toBe("/apex_test");
    expect(test.globalSetup).toContain("tests/integration/globalSetup.ts");
    expect(test.setupFiles).toContain("tests/integration/guard.ts");
  });

  it("a refusing guard stops a test file's own (destructive) setup and tests from running", () => {
    const marker = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "guard-order-")), "marker");
    const vitestCli = createRequire(import.meta.url).resolve("vitest/vitest.mjs");
    const config = path.resolve(import.meta.dirname, "fixtures/guardOrder/vitest.fixture.config.ts");
    let failed = false;
    try {
      execFileSync(process.execPath, [vitestCli, "run", "--config", config], {
        env: { ...process.env, GUARD_ORDER_MARKER: marker },
        stdio: "pipe",
      });
    } catch {
      failed = true; // the run fails because the guard refused — that's expected
    }
    expect(failed).toBe(true);
    expect(fs.existsSync(marker)).toBe(false);
  }, 60_000);
});
