import { defineConfig } from "vitest/config";
import { integrationDatabaseUrl } from "./tests/integration/testDatabase.js";

// The integration suite runs against its own database (apex_test), never the development one:
// its files wipe and re-seed every table they touch. The checked test URL is handed to the test
// workers as DATABASE_URL — set before the test files' own `import "dotenv/config"`, which never
// overrides a variable that's already set.
const testDatabaseUrl = integrationDatabaseUrl();

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.int.test.ts"],
    env: { DATABASE_URL: testDatabaseUrl },
    // Creates/migrates apex_test and proves the connection lands on it, once, before anything.
    globalSetup: ["tests/integration/globalSetup.ts"],
    // Re-checks the connected database before each file's own (destructive) setup runs.
    setupFiles: ["tests/integration/guard.ts"],
    // Integration test files share one real Postgres instance and each re-seed it in
    // beforeAll — running them concurrently races the seed's delete-then-recreate against
    // itself across files, so they must run one file at a time.
    fileParallelism: false,
  },
});
