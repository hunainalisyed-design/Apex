import { expect, test, type Page } from "@playwright/test";

// Spec 37 — "Drive It" runs in the real 3D scene. This headless browser renders WebGL in
// software (a few frames a second), so the budgets are generous; the drive itself is timed by
// the clock, not by frames, so it still completes in its 40 seconds.

async function openShowroom(page: Page, slug = "apex-gt") {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto(`/configure/${slug}`);
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 120_000 });
  return errors;
}

async function startDrive(page: Page) {
  const button = page.getByRole("button", { name: /Drive It/ });
  await expect(button).toBeEnabled({ timeout: 60_000 });
  await button.click({ timeout: 60_000 });
  await expect(page.getByTestId("drive-hud")).toBeVisible({ timeout: 90_000 });
}

async function steeringValue(page: Page): Promise<number> {
  return Number(await page.getByRole("slider", { name: "Steering" }).getAttribute("aria-valuenow"));
}

test.describe("Drive It mini-mode (Spec 37)", () => {
  test("drives with bounded steering, and Escape returns to the showroom (AC-1, AC-2, AC-5)", async ({ page }) => {
    test.setTimeout(420_000);
    const errors = await openShowroom(page);
    await startDrive(page);

    await expect(page.getByRole("progressbar", { name: "Drive progress" })).toBeVisible();
    expect(await steeringValue(page)).toBe(0);

    // Holding right drifts the car to the edge of the band — and never past it.
    await page.keyboard.down("ArrowRight");
    await expect.poll(() => steeringValue(page), { timeout: 60_000 }).toBe(100);
    for (let i = 0; i < 5; i++) {
      expect(await steeringValue(page)).toBeLessThanOrEqual(100);
      await page.waitForTimeout(400);
    }
    await page.keyboard.up("ArrowRight");
    // Letting go brings it back onto the path.
    await expect.poll(() => steeringValue(page), { timeout: 60_000 }).toBeLessThan(10);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("drive-hud")).toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByRole("button", { name: /Drive It/ })).toBeFocused({ timeout: 30_000 });
    await expect(page.getByRole("group", { name: "Camera presets" }).getByRole("button").first()).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test("finishes by itself and returns to the showroom (AC-4)", async ({ page }) => {
    test.setTimeout(420_000);
    const errors = await openShowroom(page);
    await startDrive(page);
    // 40 s of driving, plus the fades — then it's over on its own.
    await expect(page.getByTestId("drive-hud")).toHaveCount(0, { timeout: 120_000 });
    await expect(page.getByRole("button", { name: /Drive It/ })).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test("is not offered with reduced motion (AC-6)", async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openShowroom(page);
    await expect(page.getByRole("button", { name: "Capture Build" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Drive It/ })).toHaveCount(0);
  });
});
