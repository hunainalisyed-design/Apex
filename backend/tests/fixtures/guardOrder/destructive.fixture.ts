import fs from "node:fs";
import { beforeAll, it } from "vitest";

// Stands in for an integration test file: its own beforeAll is where the wiping happens.
beforeAll(() => {
  fs.writeFileSync(process.env.GUARD_ORDER_MARKER!, "destructive setup ran");
});

it("would run a test", () => {
  fs.writeFileSync(process.env.GUARD_ORDER_MARKER!, "test ran");
});
