import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

/**
 * The integration suite's own database. Its test files wipe and re-seed whatever database they
 * run against (every user, session and build), so they must never reach the development
 * database (apex_dev). Every check here fails closed: anything that isn't clearly a *_test
 * database stops the suite before a single row is touched.
 */

export const TEST_DATABASE_NAME = "apex_test";

/** The database name in a Postgres connection URL (its path), or "" if there isn't one. */
export function databaseNameOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}

export function isTestDatabaseName(name: string): boolean {
  return name.endsWith("_test");
}

/**
 * The URL the integration suite connects to: TEST_DATABASE_URL if it's set, otherwise the
 * development DATABASE_URL with its database swapped for apex_test (same server, same
 * credentials, separate database).
 */
export function resolveTestDatabaseUrl(env: { TEST_DATABASE_URL?: string; DATABASE_URL?: string }): string {
  if (env.TEST_DATABASE_URL) return env.TEST_DATABASE_URL;
  if (!env.DATABASE_URL) {
    throw new Error("Integration tests need TEST_DATABASE_URL (or DATABASE_URL to derive it from) — see backend/.env.example.");
  }
  const url = new URL(env.DATABASE_URL);
  url.pathname = `/${TEST_DATABASE_NAME}`;
  return url.toString();
}

/** Throws unless `url` names a *_test database — the last word before anything destructive. */
export function assertTestDatabaseUrl(url: string | undefined): asserts url is string {
  if (!url) throw new Error("Refusing to run integration tests: no DATABASE_URL is set.");
  const name = databaseNameOf(url);
  if (!isTestDatabaseName(name)) {
    throw new Error(
      `Refusing to run integration tests against "${name}": they wipe the database they use, ` +
        `so it must be a *_test database (expected "${TEST_DATABASE_NAME}").`,
    );
  }
}

/**
 * The integration suite's database URL, checked: from TEST_DATABASE_URL, else derived from
 * DATABASE_URL — each taken from the environment first, then backend/.env. .env is only read,
 * never loaded into this process, so nothing here can leak the development URL into anything else.
 */
export function integrationDatabaseUrl(): string {
  const envFile = path.resolve(import.meta.dirname, "../../.env");
  const fileEnv = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
  const url = resolveTestDatabaseUrl({
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL,
    DATABASE_URL: process.env.DATABASE_URL ?? fileEnv.DATABASE_URL,
  });
  assertTestDatabaseUrl(url);
  return url;
}
