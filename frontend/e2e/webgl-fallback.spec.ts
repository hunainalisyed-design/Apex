import { expect, test } from "@playwright/test";

// Forces every WebGL context request to fail before any app script runs, simulating a
// browser/device without WebGL support so Canvas3DErrorBoundary's fallback path is
// exercised for real rather than via a mocked component throw (Spec 12, AC-1).
async function disableWebGL(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error — overriding with a narrower signature is fine for this test double.
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
        return null;
      }
      return originalGetContext.apply(this, [type, ...args] as never);
    };
  });
}

test("landing hero shows the vehicle-specific static fallback when WebGL is unavailable (AC-1)", async ({
  page,
}) => {
  await disableWebGL(page);
  await page.goto("/");

  // Scoped to <main> (Hero's own landmark) — the scroll showcase below it (Spec 13) also
  // wraps its own Canvas in Canvas3DErrorBoundary and independently shows the same
  // vehicle's fallback when WebGL is unavailable, so an unscoped query would find two.
  const hero = page.locator("main");
  await expect(hero.getByText(/3D preview unavailable/i)).toBeVisible({ timeout: 10000 });
  await expect(hero.getByRole("heading", { name: "Apex GT" })).toBeVisible();
  await expect(hero.getByText(/hp$/)).toBeVisible();
  // The rest of the page stays usable even though the 3D scene failed.
  await expect(page.getByRole("link", { name: "Configure Your Car" })).toBeVisible();
});

test("the configurator shows the vehicle-specific static fallback when WebGL is unavailable (AC-1)", async ({
  page,
}) => {
  await disableWebGL(page);
  await page.goto("/configure/apex-gt");

  await expect(page.getByText(/3D preview unavailable/i)).toBeVisible({ timeout: 10000 });
  const fallbackHeading = page.getByRole("heading", { name: "Apex GT", level: 2 });
  await expect(fallbackHeading).toBeVisible();
  // Camera/lighting controls are showroom-specific and hide when the scene errors; the
  // spec sheet and customization panels stay usable regardless (AC-4 from Spec 4/5).
  await expect(page.getByRole("group", { name: "Camera presets" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
});
