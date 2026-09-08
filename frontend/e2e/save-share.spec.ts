import { expect, test } from "@playwright/test";

const BACKEND_URL = "http://localhost:4000";

async function readSummaryTotal(page: import("@playwright/test").Page): Promise<number> {
  const text = await page.getByTestId("build-summary-total").textContent();
  return Number(text!.replace(/[^\d]/g, ""));
}

test("saving, copying, and opening a shared link in a fresh browser context recreates the identical build (AC-1, AC-2, AC-4, AC-6, AC-7)", async ({
  page,
  context,
  browser,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  await page.getByRole("button", { name: /Brake Calipers:.*Red/ }).click();
  await page.getByRole("tab", { name: "Accessories" }).click();
  await page.getByRole("button", { name: /Accessories:.*Sport Exhaust/ }).click();

  const summary = page.getByLabel("Your build summary");
  await expect(summary.getByText("Brake Calipers: Red")).toBeVisible();
  const originalTotal = await readSummaryTotal(page);

  await page.getByRole("button", { name: "Save" }).click();
  const publicIdLocator = page.getByTestId("saved-public-id");
  await expect(publicIdLocator).toBeVisible({ timeout: 10000 });
  const publicId = (await publicIdLocator.textContent())!.trim();
  expect(publicId).toMatch(/^[A-Z]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);

  await page.getByRole("button", { name: "Copy Configuration ID" }).click();
  await expect(page.getByText("Configuration ID copied")).toBeVisible();
  const copiedId = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedId).toBe(publicId);

  // Toasts stack rather than replace one another (Spec 12, AC-8) — the ID-copied toast may
  // still be visible when the share-link one appears, so this scopes to the new one
  // specifically rather than assuming a single status region.
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByText("Share link copied")).toBeVisible();
  const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedUrl).toContain(`/configure/apex-gt?build=${publicId}`);

  // A brand-new browser context — the strongest available session isolation, proving the
  // build is recreated purely from the shared URL, not any client-side state.
  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();
  await freshPage.goto(copiedUrl);
  await expect(freshPage.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  const freshSummary = freshPage.getByLabel("Your build summary");
  await expect(freshSummary.getByText("Brake Calipers: Red")).toBeVisible();
  await expect(freshSummary.getByText(/Accessories: Sport Exhaust/)).toBeVisible();
  expect(await readSummaryTotal(freshPage)).toBe(originalTotal);

  await freshContext.close();
});

test("a failed save leaves selections untouched and lets the user retry (AC-10)", async ({ page }) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  await page.getByRole("button", { name: /Brake Calipers:.*Red/ }).click();

  // Force a save failure without touching the real backend: intercept the POST.
  await page.route("**/api/configurations", (route) => {
    if (route.request().method() === "POST") {
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL", message: "Save failed." }) });
    } else {
      route.continue();
    }
  });

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();

  const summary = page.getByLabel("Your build summary");
  await expect(summary.getByText("Brake Calipers: Red")).toBeVisible();
});

test("Reset reverts configuration selections without affecting the camera view's own Reset (AC-8)", async ({ page }) => {
  await page.goto("/configure/apex-gt");
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  await page.getByRole("button", { name: /Brake Calipers:.*Red/ }).click();
  const summary = page.getByLabel("Your build summary");
  await expect(summary.getByText("Brake Calipers: Red")).toBeVisible();

  await page.getByRole("button", { name: "Reset configuration" }).click();

  await expect(summary.getByText(/Brake Calipers/)).not.toBeVisible();
});

test("loading a saved build for the wrong vehicle slug redirects to the correct one (AC-5)", async ({
  page,
  request,
}) => {
  const vehicleRes = await request.get(`${BACKEND_URL}/api/vehicles/apex-gt`);
  const vehicle = (await vehicleRes.json()).data;
  const singleSelections: Record<string, string> = {};
  for (const [category, options] of Object.entries(vehicle.options)) {
    const opts = options as { id: string; isDefault: boolean }[];
    const def = opts.find((o) => o.isDefault);
    if (def) singleSelections[category] = def.id;
  }
  // ACCESSORY/PACKAGE aren't single-select — drop them from the single-selections map.
  delete singleSelections.ACCESSORY;
  delete singleSelections.PACKAGE;

  const saveRes = await request.post(`${BACKEND_URL}/api/configurations`, {
    data: {
      vehicleSlug: "apex-gt",
      singleSelections,
      multiSelections: { ACCESSORY: [], PACKAGE: [] },
      customPaintHex: null,
    },
  });
  const { publicId } = (await saveRes.json()).data;

  await page.goto(`/configure/apex-rs?build=${publicId}`);
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });

  expect(page.url()).toContain(`/configure/apex-gt?build=${publicId}`);
  await expect(page.getByRole("heading", { name: "Apex GT" })).toBeVisible();
});

test("an invalid ?build= id shows a dedicated 'could not be found' state (AC-3)", async ({ page }) => {
  await page.goto("/configure/apex-gt?build=NOPE-0000-0000");

  await expect(page.getByText("This build could not be found.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a New Configuration" })).toHaveAttribute(
    "href",
    "/configure/apex-gt",
  );
});
