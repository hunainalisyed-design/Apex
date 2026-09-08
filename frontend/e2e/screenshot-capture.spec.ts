import { expect, test } from "@playwright/test";

test("capturing an unsaved build saves first, restores the camera, and downloads a correctly-named PNG (AC-1, AC-3, AC-5)", async ({
  page,
}) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  // Make an unsaved change, then move the camera away from the default framing.
  await page.getByRole("button", { name: /Brake Calipers:.*Red/ }).click();
  const presetBar = page.getByRole("group", { name: "Camera presets" });
  await presetBar.getByRole("button", { name: "Side" }).click();
  await expect(presetBar.getByRole("button", { name: "Side" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Capture Build" }).click();

  // The save-if-dirty step ran first (AC-1): SaveSharePanel now shows a real publicId.
  const publicIdLocator = page.getByTestId("saved-public-id");
  await expect(publicIdLocator).toBeVisible({ timeout: 10000 });
  const publicId = (await publicIdLocator.textContent())!.trim();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await expect(dialog.getByRole("img")).toBeVisible();

  // The camera returned to "Side" (not left on the capture's own "default" framing) —
  // AC-3, verified via the preset bar's own highlighted-button state.
  await expect(presetBar.getByRole("button", { name: "Side" })).toHaveAttribute("aria-pressed", "true");

  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Save Image" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe(`apex-gt-${publicId}.png`);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
});

test("capturing again with nothing changed since the last save skips a redundant save (AC-2)", async ({ page }) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  await page.getByRole("button", { name: /Brake Calipers:.*Red/ }).click();
  await page.getByRole("button", { name: "Capture Build" }).click();

  const publicIdLocator = page.getByTestId("saved-public-id");
  await expect(publicIdLocator).toBeVisible({ timeout: 10000 });
  const firstPublicId = (await publicIdLocator.textContent())!.trim();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();

  let postCount = 0;
  await page.route("**/api/configurations", (route) => {
    if (route.request().method() === "POST") postCount++;
    route.continue();
  });

  await page.getByRole("button", { name: "Capture Build" }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

  expect(postCount).toBe(0);
  expect((await publicIdLocator.textContent())!.trim()).toBe(firstPublicId);
});

test("the same capture flow works on a touch device (AC-6)", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  await page.getByRole("button", { name: /Brake Calipers:.*Red/ }).tap();
  await page.getByRole("button", { name: "Capture Build" }).tap();

  await expect(page.getByTestId("saved-public-id")).toBeVisible({ timeout: 10000 });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await expect(dialog.getByRole("img")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Save Image" }).tap();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^apex-gt-[A-Z]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\.png$/);

  await context.close();
});
