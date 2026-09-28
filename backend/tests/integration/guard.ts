import { beforeAll } from "vitest";
import { assertTestDatabaseUrl, databaseNameOf, isTestDatabaseName } from "./testDatabase.js";

// Runs before every integration test file, ahead of the file's own beforeAll (where it wipes
// and re-seeds tables). Two checks: the URL this process was given, now; and the database the
// shared Prisma client is actually connected to, before any test code runs.
assertTestDatabaseUrl(process.env.DATABASE_URL);

beforeAll(async () => {
  const { prisma } = await import("../../src/lib/prisma.js");
  const [{ current_database: connected }] = await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
  if (connected !== databaseNameOf(process.env.DATABASE_URL!) || !isTestDatabaseName(connected)) {
    throw new Error(`Refusing to run integration tests: connected to "${connected}", not the test database.`);
  }
});
