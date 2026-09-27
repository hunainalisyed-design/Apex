import { expect, test, type Page } from "@playwright/test";

// Spec 35 — AI concept renders are OFF by default (no image provider is connected yet), so
// the button only exists in a build made with NEXT_PUBLIC_CONCEPT_RENDERS_ENABLED=true. Run
// with that variable set (for both `next build` and the test) to cover the flow; without it,
// this checks the feature really is hidden. The backend is mocked: no provider, no cost.
// WebGL is off (as in webgl-fallback.spec.ts) — this has nothing to do with the 3D scene.
const ENABLED = process.env.NEXT_PUBLIC_CONCEPT_RENDERS_ENABLED === "true";
const LABEL = "AI Concept — Not a Real Configuration";
// A 1×1 PNG.
const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function openConfigurator(page: Page) {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error — overriding with a narrower signature is fine for this test double.
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
      return originalGetContext.apply(this, [type, ...args] as never);
    };
  });
  await page.goto("/configure/apex-gt");
  await expect(page.getByText(/3D preview unavailable/i)).toBeVisible({ timeout: 30000 });
}

test.describe("AI concept renders (Spec 35)", () => {
  test("imagines a concept of the build: clearly labeled, never applicable (AC-1–AC-3)", async ({ page }) => {
    test.skip(!ENABLED, "needs a build with NEXT_PUBLIC_CONCEPT_RENDERS_ENABLED=true");
    const requests: unknown[] = [];
    await page.route("**/api/ai/concept-render", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { imageUrl: PNG_DATA_URL, isPlaceholder: false } }) });
    });
    await openConfigurator(page);

    await page.getByRole("button", { name: "Imagine the Ultimate Version" }).click();
    const dialog = page.getByRole("dialog", { name: "The Ultimate Version" });
    await expect(dialog.getByTestId("concept-label")).toHaveText(LABEL);
    const image = dialog.getByRole("img", { name: /AI concept image imagining a more extreme Apex GT/ });
    await expect(image).toHaveAttribute("src", PNG_DATA_URL);
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1);
    await expect(dialog.getByRole("button", { name: /apply/i })).toHaveCount(0);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ vehicleSlug: "apex-gt" });

    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Imagine the Ultimate Version" })).toBeFocused();
  });

  test("a failed generation says so and can be retried, without touching the rest of the page (AC-4)", async ({ page }) => {
    test.skip(!ENABLED, "needs a build with NEXT_PUBLIC_CONCEPT_RENDERS_ENABLED=true");
    let calls = 0;
    await page.route("**/api/ai/concept-render", async (route) => {
      calls += 1;
      if (calls === 1) {
        await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ code: "IMAGE_PROVIDER_ERROR", message: "x" }) });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { imageUrl: PNG_DATA_URL, isPlaceholder: true } }) });
      }
    });
    await openConfigurator(page);

    await page.getByRole("button", { name: "Imagine the Ultimate Version" }).click();
    const dialog = page.getByRole("dialog", { name: "The Ultimate Version" });
    await expect(dialog.getByRole("alert")).toHaveText("Couldn't generate a concept right now — try again.");
    await dialog.getByRole("button", { name: "Try Again" }).click();
    await expect(dialog.getByText("Development placeholder — no image provider is connected yet.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("total-price")).toBeVisible();
  });

  test("is hidden entirely while turned off (the default)", async ({ page }) => {
    test.skip(ENABLED, "this build has concept renders turned on");
    await openConfigurator(page);
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Imagine the Ultimate Version" })).toHaveCount(0);
  });
});
