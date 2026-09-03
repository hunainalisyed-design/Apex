import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.int.test.ts"],
    // Integration test files share one real Postgres instance and each re-seed it in
    // beforeAll — running them concurrently races the seed's delete-then-recreate against
    // itself across files, so they must run one file at a time.
    fileParallelism: false,
  },
});
