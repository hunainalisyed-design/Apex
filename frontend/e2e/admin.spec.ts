import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

/** fullyParallel workers share one real backend/DB — a unique email per test run avoids
 * collisions with any prior run's leftover rows (matches my-garage.spec.ts's convention). */
function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

const BACKEND_DIR = path.resolve(__dirname, "../../backend");

/** There is deliberately no self-service path to ADMIN anywhere in the product (Spec 21,
 * Risk #1) — the only way to become one is the backend's one-off promoteAdmin.ts script, so
 * this test shells out to the exact same script a real deploy would run, rather than
 * reaching into Prisma directly from the frontend test suite. */
function promoteToAdmin(email: string): void {
  execFileSync("npm", ["run", "promote-admin", "--", email], { cwd: BACKEND_DIR, stdio: "pipe", shell: true });
}

async function signUp(page: import("@playwright/test").Page, email: string, name: string, password: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign Up" }).click();
  await expect(page).toHaveURL("/");
}

test("a non-admin (including signed-out) visitor gets a real 404 at /admin, not a forbidden page (AC-1)", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Page not found." })).toBeVisible();

  const email = uniqueEmail("e2e-admin-guard");
  await signUp(page, email, "Regular User", "regularpass1");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Page not found." })).toBeVisible();
});

test("admin creates a vehicle and edits an option's price, both reflected immediately in the public API (AC-2, AC-3)", async ({ page }) => {
  const email = uniqueEmail("e2e-admin-flow");
  await signUp(page, email, "Flow Owner", "flowadminpass1");
  promoteToAdmin(email);
  await page.reload(); // re-fetches GET /api/auth/me so authStore picks up the new role

  await expect(
    page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Admin", exact: true }),
  ).toBeVisible();

  const unique = Date.now();
  const slug = `e2e-flow-${unique}`;
  const name = `E2E Flow Car ${unique}`;
  await page.goto("/admin/vehicles");
  await page.getByRole("button", { name: "Add Vehicle" }).click();
  await page.getByLabel("Slug").fill(slug);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Tagline").fill("Created by the admin E2E test.");
  await page.getByLabel("Base price (cents)").fill("2000000");
  await page.getByLabel("Currency").fill("EUR");
  await page.getByLabel("Horsepower").fill("450");
  await page.getByLabel("Top speed (km/h)").fill("280");
  await page.getByLabel("0-100 (s)").fill("4.0");
  await page.getByLabel("Hero model URL").fill("/models/e2e-flow/hero.glb");
  await page.getByLabel(/Showroom model URL/).fill("/models/e2e-flow/showroom.glb");
  await page.getByLabel("Thumbnail URL").fill("/models/e2e-flow/thumb.jpg");
  await page.getByLabel("Fallback image URL").fill("/models/e2e-flow/fallback.jpg");
  await page.getByRole("button", { name: "Create vehicle" }).click();

  const vehicleRow = page.locator("tr", { hasText: name });
  await expect(vehicleRow).toBeVisible();

  // AC-2: reflected immediately in the public GET /api/vehicles.
  const publicVehicles = await page.request.get("http://localhost:4000/api/vehicles").then((r) => r.json());
  expect(publicVehicles.data.some((v: { slug: string }) => v.slug === slug)).toBe(true);

  await vehicleRow.getByRole("button", { name: "Options" }).click();
  await page.getByRole("button", { name: "Add Option" }).click();
  await page.getByLabel("Name").fill("Flow Paint");
  await page.getByLabel("Price delta (cents)").fill("100000");
  await page.getByLabel("Asset ref").fill("paint-e2e-flow");
  await page.getByRole("button", { name: "Create option" }).click();

  const optionRow = page.locator("tr", { hasText: "Flow Paint" });
  await expect(optionRow).toBeVisible();
  await expect(optionRow.getByText("€1,000")).toBeVisible();

  // AC-3: edit the option's price.
  await optionRow.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Price delta (cents)").fill("150000");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(optionRow.getByText("€1,500")).toBeVisible();
});

test(
  "deactivating an option already used in a saved build keeps that build intact, and it disappears from the public catalog (AC-3, AC-6)",
  async ({ page }) => {
    const email = uniqueEmail("e2e-admin-integrity");
    await signUp(page, email, "Integrity Owner", "integrityadminpass1");
    promoteToAdmin(email);
    await page.reload();

    // Uses the existing, fully-catalogued apex-gt (rather than a freshly created vehicle,
    // which would only have the one option this test itself adds) so saving a build stays
    // valid — every OTHER single-select category still has its normal default selection.
    // ACCESSORY is multi-select and optional, so adding one new option here can't collide
    // with the single-default invariant at all.
    const apexGt = page.locator("tr", { hasText: "Apex GT" });
    await page.goto("/admin/vehicles");
    await apexGt.getByRole("button", { name: "Options" }).click();

    const unique = Date.now();
    const optionName = `Flow Accessory ${unique}`;
    const assetRef = `accessory-e2e-flow-${unique}`;

    await page.getByRole("button", { name: "Add Option" }).click();
    await page.getByLabel("Category", { exact: true }).selectOption("ACCESSORY");
    await page.getByLabel("Name").fill(optionName);
    await page.getByLabel("Price delta (cents)").fill("15000");
    await page.getByLabel("Asset ref").fill(assetRef);
    await page.getByRole("button", { name: "Create option" }).click();

    const optionRow = page.locator("tr", { hasText: optionName });
    await expect(optionRow).toBeVisible();

    // Save a real build on the public configurator selecting this new accessory.
    await page.goto("/configure/apex-gt");
    await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });
    await page.getByRole("tab", { name: "Accessories" }).click();
    await page.getByRole("button", { name: new RegExp(optionName) }).click();
    await page.getByRole("button", { name: "Save" }).click();
    const publicId = (await page.getByTestId("saved-public-id").textContent())!.trim();

    // Deactivate the option the saved build is using (AC-3's soft-delete, confirmed).
    await page.goto("/admin/vehicles");
    await apexGt.getByRole("button", { name: "Options" }).click();
    await optionRow.getByRole("button", { name: "Deactivate" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Deactivate", exact: true }).click();
    await expect(optionRow.getByText("Deactivated")).toBeVisible();

    // The saved build must still load correctly and not break — its price still reflects
    // the deactivated option's historical priceDeltaCents (€85,000 base + €150 accessory).
    // The option's own swatch legitimately no longer renders at all: a deactivated option is
    // filtered out of vehicle.options entirely (same catalog data every visitor sees), not
    // specially re-shown as still-choosable just because this one build once selected it —
    // that's what "not broken" means for AC-3, not that the UI keeps offering a retired
    // option. (AC-6's audit-log write is covered at the integration level,
    // backend/tests/integration/admin.int.test.ts.)
    await page.goto(`/configure/apex-gt?build=${publicId}`);
    await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 15000 });
    await expect(page.getByText("€85,150")).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(optionName) })).toHaveCount(0);

    // ...but it no longer appears in a fresh, default build's accessory list.
    const publicOptions = await page.request.get("http://localhost:4000/api/vehicles/apex-gt/options").then((r) => r.json());
    expect(publicOptions.data.some((o: { assetRef: string }) => o.assetRef === assetRef)).toBe(false);
  },
);

test("leads and reservations sections render for an admin without error (AC-4, AC-5)", async ({ page }) => {
  const email = uniqueEmail("e2e-admin-sections");
  await signUp(page, email, "Sections Owner", "sectionsadminpass1");
  promoteToAdmin(email);
  await page.reload();

  await page.goto("/admin/leads");
  await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();

  await page.goto("/admin/reservations");
  await expect(page.getByRole("heading", { name: "Reservations" })).toBeVisible();
});
