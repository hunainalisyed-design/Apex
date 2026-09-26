import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Shares the headless browser's software renderer between tests — serial keeps each capture fast enough.
test.describe.configure({ mode: "serial" });

/** Unique per run — workers share one real backend/DB (my-garage.spec.ts's convention). */
function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

const BACKEND_DIR = path.resolve(__dirname, "../../backend");

function promoteToAdmin(email: string): void {
  execFileSync("npm", ["run", "promote-admin", "--", email], { cwd: BACKEND_DIR, stdio: "pipe", shell: true });
}

async function signUp(page: Page, email: string, name: string, password: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Sign Up" }).click();
  await expect(page).toHaveURL("/");
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page).toHaveURL("/");
}

async function logOut(page: Page) {
  await page.getByRole("navigation", { name: "Primary" }).getByRole("button", { name: "Log Out" }).click();
  await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Log In" })).toBeVisible();
}

/** Publishes from the configurator (the only place with the 3D scene the image is captured from).
 * The capture renders a real WebGL frame — seconds on a GPU, minutes under this headless
 * browser's software WebGL (see shareable-video.spec.ts), hence the long budgets. */
async function publishFromConfigurator(page: Page, url: string): Promise<string> {
  await page.goto(url);
  await expect(page.locator("[data-scene-ready='true']")).toBeAttached({ timeout: 60000 });
  await page.getByRole("button", { name: "Publish to Gallery" }).click({ timeout: 60000 });
  await expect(page.getByText("Published", { exact: true })).toBeVisible({ timeout: 300000 });
  return (await page.getByTestId("saved-public-id").textContent())!.trim();
}

function galleryCard(page: Page, publicId: string) {
  return page.getByTestId("gallery-card").filter({ has: page.locator(`a[href*="${publicId}"]`) });
}

test("publish → appears in the gallery → a second account likes it → unpublish removes it → republish keeps the like (AC-1, AC-3, AC-4, AC-6)", async ({
  page,
}) => {
  test.setTimeout(900_000);
  const publisher = { email: uniqueEmail("e2e-gallery-pub"), password: "gallerypass1" };
  await signUp(page, publisher.email, "Gallery Publisher", publisher.password);

  // AC-1: one click in the configurator saves, captures and publishes.
  const publicId = await publishFromConfigurator(page, "/configure/apex-gt");

  await page.goto("/gallery");
  const card = galleryCard(page, publicId);
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { name: "Apex GT" })).toBeVisible();
  await expect(card.getByTestId("like-count")).toHaveText("0 likes");
  // The captured image really loads from the API.
  await expect
    .poll(() => card.getByRole("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBe(1600);
  await logOut(page);

  // AC-4: a signed-out visitor can browse, but liking asks them to sign in.
  await page.goto("/gallery");
  await galleryCard(page, publicId).getByRole("button", { name: /^Like this/ }).click();
  await expect(page.getByRole("dialog", { name: "Sign in to like builds" })).toBeVisible();
  await page.getByRole("button", { name: "Not Now" }).click();

  // AC-3: a second account likes it; clicking again removes the like, and once more restores it.
  await signUp(page, uniqueEmail("e2e-gallery-fan"), "Gallery Fan", "gallerypass2");
  await page.goto("/gallery");
  const fanCard = galleryCard(page, publicId);
  const like = fanCard.getByRole("button", { name: /^Like this/ });
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(fanCard.getByTestId("like-count")).toHaveText("1 like");
  await like.click();
  await expect(fanCard.getByTestId("like-count")).toHaveText("0 likes");
  await like.click();
  await expect(fanCard.getByTestId("like-count")).toHaveText("1 like");
  await page.reload();
  await expect(galleryCard(page, publicId).getByRole("button", { name: /^Like this/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await logOut(page);

  // AC-6: the owner unpublishes from My Garage; it leaves the gallery immediately.
  await logIn(page, publisher.email, publisher.password);
  await page.goto("/garage");
  const garageCard = page.locator(".glass-panel", { has: page.locator(`a[href*="${publicId}"]`) }).first();
  await expect(garageCard.getByText("Published", { exact: true })).toBeVisible();
  await garageCard.getByRole("button", { name: "Unpublish" }).click();
  await expect(garageCard.getByText("Published", { exact: true })).not.toBeVisible();

  await page.goto("/gallery");
  await expect(page.getByRole("button", { name: "Most Recent" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("gallery-skeleton").first()).not.toBeVisible();
  await expect(galleryCard(page, publicId)).toHaveCount(0);

  // …and its like survived: republishing brings it back with the like intact.
  await publishFromConfigurator(page, `/configure/apex-gt?build=${publicId}`);
  await page.goto("/gallery");
  await expect(galleryCard(page, publicId).getByTestId("like-count")).toHaveText("1 like");
});

test("an admin can take any published build out of the gallery (moderation safety valve)", async ({ page }) => {
  test.setTimeout(600_000);
  await signUp(page, uniqueEmail("e2e-gallery-owner"), "Gallery Owner", "gallerypass3");
  const publicId = await publishFromConfigurator(page, "/configure/apex-gt");
  await logOut(page);

  const adminEmail = uniqueEmail("e2e-gallery-admin");
  await signUp(page, adminEmail, "Gallery Admin", "galleryadminpass1");
  promoteToAdmin(adminEmail);
  await page.reload();

  await page.goto("/admin");
  await page.locator("main").getByRole("link", { name: /^Gallery/ }).click();
  await expect(page).toHaveURL("/admin/gallery");
  await page.getByRole("button", { name: `Unpublish Apex GT build ${publicId}` }).click();
  await expect(page.getByRole("button", { name: `Unpublish Apex GT build ${publicId}` })).toHaveCount(0);

  await page.goto("/gallery");
  await expect(page.getByTestId("gallery-skeleton").first()).not.toBeVisible();
  await expect(galleryCard(page, publicId)).toHaveCount(0);
});

test("the nav links to the gallery", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Gallery" }).first().click();
  await expect(page).toHaveURL("/gallery");
  await expect(page.getByRole("heading", { level: 1, name: "Community Builds" })).toBeVisible();
});
