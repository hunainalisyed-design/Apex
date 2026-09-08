import { expect, test } from "@playwright/test";

test("Tab as the first action reveals the skip link, and activating it moves focus to #main-content (AC-6)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "BUILD YOUR VISION." })).toBeVisible();

  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  await page.keyboard.press("Enter");

  await expect(page.locator("#main-content")).toBeFocused();
});

test("the skip link is present and lands on #main-content in the configurator too", async ({ page }) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("the configurator's key interactive controls are keyboard-reachable and show a visible focus outline (AC-7)", async ({
  page,
}) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  const saveButton = page.getByRole("button", { name: "Save" });
  await saveButton.focus();
  await expect(saveButton).toBeFocused();

  const outlineWidth = await saveButton.evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(outlineWidth).not.toBe("0px");

  const captureButton = page.getByRole("button", { name: "Capture Build" });
  await captureButton.focus();
  await expect(captureButton).toBeFocused();
  const captureOutlineWidth = await captureButton.evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(captureOutlineWidth).not.toBe("0px");
});
