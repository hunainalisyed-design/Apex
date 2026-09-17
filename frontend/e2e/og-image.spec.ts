import { expect, test } from "@playwright/test";

test.describe("dynamic OG image route (Spec 23, AC-2)", () => {
  test("renders a real PNG for a known vehicle's default state", async ({ request }) => {
    const res = await request.get("/api/og?slug=apex-gt");

    expect(res.ok()).toBe(true);
    expect(res.headers()["content-type"]).toBe("image/png");
    expect((await res.body()).byteLength).toBeGreaterThan(0);
  });

  test("still renders successfully (never 500) for an unknown build id, per this spec's own Rollout note", async ({
    request,
  }) => {
    const res = await request.get("/api/og?slug=apex-gt&build=NOPE-0000-0000");

    expect(res.ok()).toBe(true);
    expect(res.headers()["content-type"]).toBe("image/png");
  });

  test("still renders successfully (never 500) for an unknown vehicle slug", async ({ request }) => {
    const res = await request.get("/api/og?slug=not-a-real-vehicle");

    expect(res.ok()).toBe(true);
    expect(res.headers()["content-type"]).toBe("image/png");
  });
});
