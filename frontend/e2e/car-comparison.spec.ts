import { expect, test } from "@playwright/test";

test("/compare with no params defaults to the first two vehicles in both the table and the selectors (AC-1, AC-2)", async ({
  page,
}) => {
  await page.goto("/compare");

  await expect(page.getByRole("columnheader", { name: "Apex GT" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Apex RS" })).toBeVisible();
  await expect(page.getByLabel("Vehicle 1")).toHaveValue("apex-gt");
  await expect(page.getByLabel("Vehicle 2")).toHaveValue("apex-rs");

  // AC-2's example-table fields.
  await expect(page.getByRole("row", { name: /Power/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /0–100/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Top Speed/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Starting Price/ })).toBeVisible();
});

test("each selector genuinely excludes the vehicle chosen on the other side, not just discourages it (AC-4)", async ({
  page,
}) => {
  await page.goto("/compare");

  const leftSelect = page.getByLabel("Vehicle 1");
  const rightSelect = page.getByLabel("Vehicle 2");

  await expect(leftSelect.locator("option", { hasText: "Apex RS" })).toHaveCount(0);
  await expect(rightSelect.locator("option", { hasText: "Apex GT" })).toHaveCount(0);
});

test("a shared /compare link renders the exact pair it names (AC-3)", async ({ page }) => {
  // Today's real catalog only has two vehicles, so the mutual-exclusion rule (AC-4) means
  // neither selector ever has an actual alternative to switch to via a live click — this
  // direct-navigation check exercises AC-3's URL-to-render direction for real instead
  // (documented trade-off; a live selector-change is covered against a mocked 3-vehicle
  // catalog in CompareView.test.tsx).
  await page.goto("/compare?left=apex-rs&right=apex-gt");

  await expect(page.getByLabel("Vehicle 1")).toHaveValue("apex-rs");
  await expect(page.getByLabel("Vehicle 2")).toHaveValue("apex-gt");
  const headers = page.getByRole("columnheader");
  await expect(headers.nth(1)).toHaveText("Apex RS");
  await expect(headers.nth(2)).toHaveText("Apex GT");
});

test("toggling 3D View shows both vehicles in one shared scene, and toggling back returns to the table (AC-5)", async ({
  page,
}) => {
  await page.goto("/compare");

  await page.getByRole("tab", { name: "3D View" }).click();
  await expect(page.locator("[data-compare-scene-ready='true']")).toBeAttached({ timeout: 15000 });
  await expect(page.getByRole("columnheader", { name: "Apex GT" })).not.toBeVisible();

  await page.getByRole("tab", { name: "Spec Table" }).click();
  await expect(page.getByRole("columnheader", { name: "Apex GT" })).toBeVisible();
});

test("Configure This Vehicle navigates each side into the real configurator (AC-11)", async ({ page }) => {
  await page.goto("/compare");

  await page.getByRole("link", { name: "Configure This Vehicle" }).first().click();
  await expect(page).toHaveURL(/\/configure\/apex-gt/);

  await page.goto("/compare");
  await page.getByRole("link", { name: "Configure This Vehicle" }).nth(1).click();
  await expect(page).toHaveURL(/\/configure\/apex-rs/);
});

test("keyboard pass: both selectors and the view toggle are reachable and operable (AC-9)", async ({ page }) => {
  await page.goto("/compare");

  await page.getByLabel("Vehicle 1").focus();
  await expect(page.getByLabel("Vehicle 1")).toBeFocused();

  await page.getByRole("tab", { name: "3D View" }).focus();
  await expect(page.getByRole("tab", { name: "3D View" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-compare-scene-ready='true']")).toBeAttached({ timeout: 15000 });
});

test("on a narrow viewport the spec table scrolls within its own container, never the page itself (AC-10)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/compare");

  const bodyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth);

  await expect(page.getByRole("columnheader", { name: "Apex GT" })).toBeVisible();
});
