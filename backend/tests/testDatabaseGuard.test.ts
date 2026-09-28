import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertTestDatabaseUrl,
  databaseNameOf,
  integrationDatabaseUrl,
  resolveTestDatabaseUrl,
} from "./integration/testDatabase.js";

// The integration suite wipes the database it runs against, so these checks are what keep it
// away from the development database (apex_dev). No database is touched here.
const DEV = "postgresql://apex:apex@localhost:5432/apex_dev?schema=public";
const TEST = "postgresql://apex:apex@localhost:5432/apex_test?schema=public";

describe("integration test database safety", () => {
  it("refuses the development database", () => {
    expect(() => assertTestDatabaseUrl(DEV)).toThrow(/Refusing .* "apex_dev"/);
  });

  it("refuses any database that isn't *_test, and a missing URL", () => {
    expect(() => assertTestDatabaseUrl("postgresql://apex:apex@localhost:5432/postgres")).toThrow(/Refusing/);
    expect(() => assertTestDatabaseUrl("postgresql://apex:apex@localhost:5432/apex_test_backup")).toThrow(/Refusing/);
    expect(() => assertTestDatabaseUrl("postgresql://apex:apex@localhost:5432/")).toThrow(/Refusing/);
    expect(() => assertTestDatabaseUrl(undefined)).toThrow(/Refusing/);
  });

  it("accepts apex_test", () => {
    expect(() => assertTestDatabaseUrl(TEST)).not.toThrow();
  });

  it("uses TEST_DATABASE_URL when set", () => {
    expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: TEST, DATABASE_URL: DEV })).toBe(TEST);
  });

  it("otherwise derives apex_test from DATABASE_URL — same server and credentials, different database", () => {
    const derived = resolveTestDatabaseUrl({ DATABASE_URL: DEV });
    expect(databaseNameOf(derived)).toBe("apex_test");
    expect(derived).toBe(TEST);
  });

  describe("resolving from the environment (as CI does, with no .env)", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("given only the development DATABASE_URL, still resolves to apex_test", () => {
      vi.stubEnv("TEST_DATABASE_URL", undefined);
      vi.stubEnv("DATABASE_URL", DEV);
      // .env may still supply TEST_DATABASE_URL locally — either way it must land on apex_test.
      expect(databaseNameOf(integrationDatabaseUrl())).toBe("apex_test");
    });

    it("refuses a TEST_DATABASE_URL pointing at the development database", () => {
      vi.stubEnv("TEST_DATABASE_URL", DEV);
      expect(() => integrationDatabaseUrl()).toThrow(/Refusing .* "apex_dev"/);
    });
  });
});
