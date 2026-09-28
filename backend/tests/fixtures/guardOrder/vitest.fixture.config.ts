import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ["destructive.fixture.ts"],
    setupFiles: ["refusingGuard.ts"],
  },
});
