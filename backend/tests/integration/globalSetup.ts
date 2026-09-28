import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { databaseNameOf, integrationDatabaseUrl, isTestDatabaseName } from "./testDatabase.js";

const BACKEND_DIR = path.resolve(import.meta.dirname, "../..");
const PRISMA_CLI = createRequire(import.meta.url).resolve("prisma/build/index.js");

/**
 * Runs once before the integration suite: makes sure the test database exists and has the
 * current schema, then proves the connection really lands on it. Only ever touches the
 * *_test database — `prisma migrate deploy` creates it if it's missing and applies any
 * pending migrations; it never resets or drops anything.
 */
export default async function setup() {
  // Resolved and checked here, from the same source as the config — never this process's env.
  const url = integrationDatabaseUrl();

  execFileSync(process.execPath, [PRISMA_CLI, "migrate", "deploy"], {
    cwd: BACKEND_DIR,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });

  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const [{ current_database: connected }] = await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
    if (connected !== databaseNameOf(url) || !isTestDatabaseName(connected)) {
      throw new Error(`Refusing to run integration tests: connected to "${connected}", not the test database.`);
    }
    console.log(`[integration] using database "${connected}"`);
  } finally {
    await prisma.$disconnect();
  }
}
