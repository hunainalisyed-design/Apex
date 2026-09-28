import { beforeAll } from "vitest";

// Stands in for tests/integration/guard.ts refusing the database.
beforeAll(async () => {
  throw new Error("guard refused");
});
